// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {DiceModule} from "../../src/modules/dice/DiceModule.sol";
import {Errors} from "../../src/libs/Errors.sol";

/// @notice Characterizes where the v1.5 house edge goes, as the baseline for ADR-0032.
/// @dev Every settled bet accrues its full turnover edge E = h x usedTurnover to PF + XP
///      (SSOT v1.0 section 3.3.2). The fee kept on winning payouts offsets E in
///      expectation for fair modules, so over a win/lose pair the LP result is zero.
///      Budget settings only move value between PF and XP; no active configuration
///      leaves any share of E with LPs.
contract HouseEdgeAllocationV15Test is Test {
    uint64 internal constant POOL = 1;
    bytes32 internal constant DICE = keccak256("DICE");
    bytes internal constant RNG_DOMAIN = "SSOT_RNG_V1";
    uint256 internal constant STAKE = 10 ether;
    uint256 internal constant EDGE = 0.2 ether; // 2% of STAKE

    address internal gov = address(0xA11CE);
    address internal alice = address(0xBEEF);
    address internal bob = address(0xB0B);

    MockERC20 internal asset;
    Bank internal bank;
    GameHub internal hub;
    VRFHub internal vrf;

    function setUp() external {
        asset = new MockERC20("USD", "USD", 18);
        bank = new Bank(address(asset), gov, 1000, "LP", "LP", 18);
        PoolRegistry reg = new PoolRegistry(gov);
        SettlementRouter router = new SettlementRouter(address(reg));
        vrf = new VRFHub(address(this), gov);
        ReferralRegistry refRegistry = new ReferralRegistry(gov);

        // The Base mainnet v1.5 configuration: 2% edge, full budget, L1 takes it all.
        uint16[6] memory levelBps;
        levelBps[1] = 10_000;
        hub = new GameHub(
            address(router),
            address(vrf),
            address(refRegistry),
            address(new DefaultReferralEngine()),
            gov,
            3600,
            200,
            0,
            10_000,
            10_000,
            3000,
            levelBps,
            2
        );

        vm.startPrank(gov);
        reg.registerPool(POOL, address(asset), address(bank), SSOTTypes.PoolDomain.Casino);
        reg.setHubRegistered(address(hub), true);
        reg.setHubAllowedForPool(POOL, address(hub), true);
        bank.setSettlementRouterOnce(address(router));
        refRegistry.setBinderOnce(address(hub));
        hub.registerGame(DICE, address(new DiceModule()));
        asset.mint(gov, 10_000 ether);
        asset.approve(address(bank), type(uint256).max);
        bank.deposit(5_000 ether, gov);
        vm.stopPrank();

        asset.mint(alice, 1_000 ether);
        vm.deal(alice, 100 ether);
        vm.prank(alice);
        asset.approve(address(bank), type(uint256).max);
    }

    function test_noReferrer_entireEdgeAccruesToProtocol() external {
        _assertPair({pfPerBet: EDGE, xpPerBet: 0});
    }

    function test_withReferrer_entireEdgeAccruesToReferrer() external {
        vm.prank(alice);
        hub.bindReferrer(bob);
        _assertPair({pfPerBet: 0, xpPerBet: EDGE});
    }

    /// A 50% budget with L1 at 40% of it only reshuffles PF and XP: the non-budget half
    /// and the unassigned budget both become protocol fees.
    function test_partialBudget_onlyMovesValueBetweenProtocolAndReferrer() external {
        uint16[6] memory levelBps;
        levelBps[1] = 4_000;
        vm.startPrank(gov);
        uint32 id = hub.createReferralConfig(5_000, 10_000, 3000, levelBps, 2);
        hub.setActiveReferralConfig(id);
        vm.stopPrank();
        vm.prank(alice);
        hub.bindReferrer(bob);

        _assertPair({pfPerBet: 0.16 ether, xpPerBet: 0.04 ether});
    }

    /// The one setting that would leave the budget in the pool cannot be activated.
    function test_levelsZeroConfigCanBeCreatedButNotActivated() external {
        uint16[6] memory levelBps;
        vm.startPrank(gov);
        uint32 id = hub.createReferralConfig(5_000, 0, 3000, levelBps, 0);
        vm.expectRevert(Errors.InvalidConfig.selector);
        hub.setActiveReferralConfig(id);
        vm.stopPrank();
    }

    /// One losing and one winning 10-unit bet on a fair 50/50 dice (2x gross).
    function _assertPair(uint256 pfPerBet, uint256 xpPerBet) internal {
        (uint256 pfLose, uint256 xpLose, int256 lpLose) = _settle(false);
        (uint256 pfWin, uint256 xpWin, int256 lpWin) = _settle(true);

        assertEq(pfLose, pfPerBet, "PF on the losing bet");
        assertEq(xpLose, xpPerBet, "XP on the losing bet");
        assertEq(pfWin, pfPerBet, "PF on the winning bet");
        assertEq(xpWin, xpPerBet, "XP on the winning bet");
        assertEq(pfLose + xpLose, EDGE, "the full edge accrues even when the player loses");
        assertEq(lpLose, int256(STAKE - EDGE), "LP keeps the stake minus the accrued edge");
        assertEq(lpWin, -int256(STAKE - EDGE), "LP pays the net win plus the accrued edge");
        assertEq(lpLose + lpWin, 0, "over a fair pair the LP receives no share of the edge");
    }

    function _settle(bool win) internal returns (uint256 pf, uint256 xp, int256 lpDelta) {
        SSOTTypes.SSOT memory before = bank.getSSOT();
        (uint256 fee,) = hub.quoteVRFFee(1);
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: STAKE, betCount: 1, stopGain: 0, stopLoss: 0});
        vm.prank(alice);
        uint256 id = hub.placeBet{value: fee}(DICE, POOL, abi.encode(true, uint8(50)), spec, address(0), 10_000);

        uint256 seed;
        for (; seed < 4096; ++seed) {
            uint256 rolled = (uint256(keccak256(abi.encodePacked(RNG_DOMAIN, id, uint256(0), seed))) % 100) + 1;
            if ((rolled > 50) == win) break;
        }
        uint256[] memory words = new uint256[](1);
        words[0] = seed;
        vrf.fulfillRandomWords(hub.getBet(id).requestId, words);
        hub.finalize(id);

        SSOTTypes.SSOT memory afterSettle = bank.getSSOT();
        pf = afterSettle.PF - before.PF;
        xp = afterSettle.XP - before.XP;
        lpDelta = int256(afterSettle.NAV) - int256(before.NAV);
    }
}
