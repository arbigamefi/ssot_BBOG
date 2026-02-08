// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";

import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {Bank} from "../../src/core/Bank.sol";
import {BankRegistry} from "../../src/core/BankRegistry.sol";
import {Hub} from "../../src/core/Hub.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {DiceModule} from "../../src/modules/dice/DiceModule.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";

import {MockVRFV2PlusWrapper} from "../../src/mocks/MockVRFV2PlusWrapper.sol";
import {ChainlinkV2PlusWrapperAdapter} from "../../src/adapters/chainlink/ChainlinkV2PlusWrapperAdapter.sol";

import {ToggleReceiver} from "../utils/ToggleReceiver.sol";

import "./Invariants.t.sol";

/// @notice Adapter-mode handler that exercises ETH overpay refunds (including refundCredit) and tracks
///         wrapper fee collection for invariants.
contract HandlerAdapter is Handler {
    MockVRFV2PlusWrapper public wrapper;
    ChainlinkV2PlusWrapperAdapter public adapter;
    ToggleReceiver public toggle;

    uint256 public expectedWrapperEth;
    uint256 public v_VRF_claimCredit;

    constructor(
        MockERC20 aA,
        MockERC20 aB,
        Bank bA,
        Bank bB,
        Hub h,
        VRFHub v,
        address g,
        address coord,
        MockVRFV2PlusWrapper w,
        ChainlinkV2PlusWrapperAdapter ad,
        ToggleReceiver t
    ) Handler(aA, aB, bA, bB, h, v, g, coord) {
        wrapper = w;
        adapter = ad;
        toggle = t;

        // Replace one actor with the toggle receiver to force refund failures.
        // Keep its ETH funded even when it rejects refunds.
        players[0] = address(t);
        vm.deal(address(t), 100 ether);
    }

    /// @dev Override to occasionally overpay VRF fee (EOAs) and always overpay for ToggleReceiver.
    function action_placeBet(uint256 seed, uint256 amountPerRoll, uint8 cap, uint16 maxHE) external override {
        (address asset, , ) = _pick(seed);
        try hub.riskInPaused(asset) returns (bool paused) {
            if (paused) return;
        } catch {
            return;
        }

        address p = players[seed % players.length];
        address affiliate = players[(seed + 1) % players.length];
        if (affiliate == p) affiliate = address(0);

        amountPerRoll = bound(amountPerRoll, 0.1 ether, 20 ether);
        cap = uint8(bound(uint256(cap), 1, 99));
        uint32 betCount = uint32(bound(seed, 1, 8));
        maxHE = uint16(bound(uint256(maxHE), uint256(hub.defaultHouseEdgeBps()), 10_000));

        if (affiliate != address(0) && affiliate != p) {
            vm.prank(p);
            try hub.bindReferrer(affiliate) { } catch { }
        }

        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: amountPerRoll,
            betCount: betCount,
            stopGain: 0,
            stopLoss: 0
        });

        (uint256 fee, ) = hub.quoteVRFFee(betCount);

        // Small deterministic overpay, to exercise best-effort refunds.
        uint256 extra = (seed % 3 == 0) ? 1e15 : 0; // 0.001 ETH
        if (p == address(toggle)) {
            extra = 1e15; // always overpay for the rejecting receiver
        }

        vm.prank(p);
        try hub.placeBet{value: fee + extra}(GAME_DICE, asset, abi.encode(cap), spec, affiliate, maxHE) returns (uint256 betId) {
            betIds.push(betId);
            _mirrorParams[betId] = abi.encode(cap);
            _mirrorStakeSpec[betId] = spec;
            _mirrorGameId[betId] = GAME_DICE;
            _observeAndTrackNewBet(betId);

            // In adapter mode, charged fee is forwarded to wrapper and retained there.
            SSOTTypes.Bet memory b = hub.getBet(betId);
            expectedWrapperEth += b.vrfFeeCharged;
        } catch { }
    }

    /// @notice Debt-out: claim VRF refund credit if any.
    ///         For the toggle receiver, temporarily allow ETH so the claim succeeds.
    function action_claimRefundCredit(uint256 seed) external {
        address p = players[seed % players.length];
        uint256 credit = vrf.refundCreditOf(p);
        if (credit == 0) return;

        bool isToggle = (p == address(toggle));
        if (isToggle) toggle.setAccept(true);
        vm.prank(p);
        try vrf.claimRefund() returns (uint256 /*amount*/ ) {
            // ok
        } catch {
            v_VRF_claimCredit++;
        }
        if (isToggle) toggle.setAccept(false);
    }
}

/// @notice Adapter-mode invariants: extend ExecutableSSOT with ETH/credit accounting checks for
///         Chainlink wrapper adapter mode.
contract MultiAssetInvariantsAdapter is StdInvariant, Test {
    MockERC20 assetA;
    MockERC20 assetB;

    Bank bankA;
    Bank bankB;

    BankRegistry registry;
    Hub hub;
    VRFHub vrf;

    MockVRFV2PlusWrapper wrapper;
    ChainlinkV2PlusWrapperAdapter adapter;
    ToggleReceiver toggle;

    HandlerAdapter handler;

    address gov = address(0xA11CE);

    function setUp() external {
        assetA = new MockERC20("AssetA", "ASTA", 18);
        assetB = new MockERC20("AssetB", "ASTB", 18);

        // Chainlink wrapper + adapter (native payment)
        wrapper = new MockVRFV2PlusWrapper();
        adapter = new ChainlinkV2PlusWrapperAdapter(address(wrapper), gov);

        // In adapter mode, VRFHub coordinator is the adapter address.
        vrf = new VRFHub(address(adapter), gov);

        vm.startPrank(gov);
        adapter.setVRFHub(address(vrf));
        adapter.setRequestGasPriceWei(0);
        vrf.setAdapter(address(adapter));
        vm.stopPrank();

        bankA = new Bank(address(assetA), address(0), gov, 1000, "LP ASTA", "LPA", 18);
        bankB = new Bank(address(assetB), address(0), gov, 1000, "LP ASTB", "LPB", 18);

        registry = new BankRegistry(gov);
        vm.startPrank(gov);
        registry.registerBank(address(assetA), address(bankA));
        registry.registerBank(address(assetB), address(bankB));
        vm.stopPrank();

        ReferralRegistry refRegistry = new ReferralRegistry(gov);
        DefaultReferralEngine refEngine = new DefaultReferralEngine();

        uint16[6] memory levelBps;
        levelBps[0] = 0;
        levelBps[1] = 10_000;

        hub = new Hub(
            address(registry),
            address(vrf),
            address(refRegistry),
            address(refEngine),
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
        bankA.setHubOnce(address(hub));
        bankB.setHubOnce(address(hub));
        refRegistry.setBinderOnce(address(hub));

        bankA.setMinPlayerTurnoverForUnlock(20 ether);
        bankB.setMinPlayerTurnoverForUnlock(20 ether);
        bankA.setHoldbackVestingSeconds(10);
        bankB.setHoldbackVestingSeconds(10);
        vm.stopPrank();

        DiceModule dice = new DiceModule();
        vm.prank(gov);
        hub.registerGame(keccak256("DICE"), address(dice));

        assetA.mint(gov, 5_000 ether);
        assetB.mint(gov, 5_000 ether);
        vm.startPrank(gov);
        assetA.approve(address(bankA), type(uint256).max);
        assetB.approve(address(bankB), type(uint256).max);
        bankA.deposit(2_000 ether, gov);
        bankB.deposit(2_000 ether, gov);
        vm.stopPrank();

        toggle = new ToggleReceiver();
        toggle.setAccept(false);

        handler = new HandlerAdapter(
            assetA,
            assetB,
            bankA,
            bankB,
            hub,
            vrf,
            gov,
            address(adapter),
            wrapper,
            adapter,
            toggle
        );
        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](19);
        selectors[0] = Handler.action_deposit.selector;
        selectors[1] = Handler.action_setAffiliateHouseEdge.selector;
        selectors[2] = Handler.action_placeBet.selector; // overridden in HandlerAdapter
        selectors[3] = Handler.action_fulfillFinalize.selector;
        selectors[4] = Handler.action_refund.selector;
        selectors[5] = Handler.action_lateFulfillRefunded.selector;
        selectors[6] = Handler.action_pause.selector;
        selectors[7] = Handler.action_withdraw.selector;
        selectors[8] = Handler.action_redeem.selector;
        selectors[9] = Handler.action_claimXPAcrued.selector;
        selectors[10] = Handler.action_placeBetWhenPausedMustFail.selector;
        selectors[11] = Handler.action_optionalOutflowWhenPausedMustFail.selector;
        selectors[12] = Handler.action_finalizeReadyMustSucceed.selector;
        selectors[13] = Handler.action_refundReadyMustSucceed.selector;
        selectors[14] = Handler.action_unlock_locked.selector;
        selectors[15] = Handler.action_sync_holdback.selector;
        selectors[16] = Handler.action_govNoAssetBackdoor.selector;
        selectors[17] = Handler.action_claimProtocolFees.selector;
        selectors[18] = HandlerAdapter.action_claimRefundCredit.selector;

        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /// @notice Adapter-mode ETH accounting invariants.
    function invariant_Z1_adapter_eth_accounting() external view {
        // Hub and adapter should not retain native token.
        assertEq(address(hub).balance, 0, "hub.ETH");
        assertEq(address(adapter).balance, 0, "adapter.ETH");

        // Wrapper retains all charged fees.
        assertEq(address(wrapper).balance, handler.expectedWrapperEth(), "wrapper.ETH");

        // VRFHub retains only refund credits.
        uint256 sum = 0;
        uint256 n = handler.playersLength();
        for (uint256 i = 0; i < n; i++) {
            address p = handler.players(i);
            sum += vrf.refundCreditOf(p);
        }
        assertEq(address(vrf).balance, sum, "vrf.ETH");

        // If claimRefund was attempted when credit existed, it must not fail.
        assertEq(handler.v_VRF_claimCredit(), 0, "refundCredit claim failed");
    }
}
