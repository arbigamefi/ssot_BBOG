// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {IGameModule} from "../../src/core/interfaces/IGameModule.sol";
import {IGameHub} from "../../src/core/interfaces/IGameHub.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";

contract RouterStakePayoutModule is IGameModule {
    function validate(bytes calldata, SSOTTypes.StakeSpec calldata stakeSpec) external pure {
        require(stakeSpec.amountPerRoll > 0 && stakeSpec.betCount > 0, "bad spec");
    }

    function maxPayout(bytes calldata, SSOTTypes.StakeSpec calldata stakeSpec) external pure returns (uint256) {
        return stakeSpec.amountPerRoll * uint256(stakeSpec.betCount);
    }

    function resolve(bytes calldata, SSOTTypes.StakeSpec calldata stakeSpec, uint256, uint256[] calldata)
        external
        pure
        returns (uint256 payoutGross, uint256 refundAmount)
    {
        payoutGross = stakeSpec.amountPerRoll * uint256(stakeSpec.betCount);
        refundAmount = 0;
    }
}

contract GameHubRouterTest is Test {
    bytes32 internal constant GAME_STAKE = keccak256("ROUTER_STAKE");

    address internal gov = address(0xA11CE);
    address internal player = address(0xBEEF);

    MockERC20 internal asset;
    Bank internal bank;
    Bank internal sportsBank;
    PoolRegistry internal poolRegistry;
    SettlementRouter internal router;
    VRFHub internal vrf;
    ReferralRegistry internal refRegistry;
    DefaultReferralEngine internal refEngine;
    GameHub internal gameHub;

    function setUp() external {
        asset = new MockERC20("USD Coin", "USDC", 6);
        bank = new Bank(address(asset), gov, 0, "LP USDC", "lpUSDC", 6);
        sportsBank = new Bank(address(asset), gov, 0, "Sports LP USDC", "slpUSDC", 6);
        poolRegistry = new PoolRegistry(gov);
        router = new SettlementRouter(address(poolRegistry));
        vrf = new VRFHub(address(this), gov);
        refRegistry = new ReferralRegistry(gov);
        refEngine = new DefaultReferralEngine();

        gameHub = new GameHub(
            address(router), address(vrf), address(refRegistry), address(refEngine), gov, 3600, 200, 0, 0, 0, 0
        );

        vm.startPrank(gov);
        poolRegistry.registerPool(1, address(asset), address(bank), SSOTTypes.PoolDomain.Casino);
        poolRegistry.registerPool(2, address(asset), address(sportsBank), SSOTTypes.PoolDomain.Sports);
        poolRegistry.setHubRegistered(address(gameHub), true);
        poolRegistry.setHubAllowedForPool(1, address(gameHub), true);
        poolRegistry.setHubAllowedForPool(2, address(gameHub), true);
        bank.setSettlementRouterOnce(address(router));
        sportsBank.setSettlementRouterOnce(address(router));
        refRegistry.setBinderOnce(address(gameHub));
        gameHub.registerGame(GAME_STAKE, address(new RouterStakePayoutModule()));
        vm.stopPrank();

        asset.mint(gov, 1_000_000e6);
        asset.mint(player, 100e6);
        vm.deal(player, 10 ether);

        vm.startPrank(gov);
        asset.approve(address(bank), type(uint256).max);
        bank.deposit(500_000e6, gov);
        vm.stopPrank();

        vm.prank(player);
        asset.approve(address(bank), type(uint256).max);
    }

    function test_placeFinalizeCasinoBetThroughSettlementRouter() external {
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10e6, betCount: 1, stopGain: 0, stopLoss: 0});
        (uint256 fee,) = gameHub.quoteVRFFee(spec.betCount);

        vm.prank(player);
        uint256 positionId = gameHub.placeBet{value: fee}(GAME_STAKE, 1, "", spec, address(0), 10_000);

        SSOTTypes.Position memory pos = router.getPosition(positionId);
        assertEq(pos.ownerHub, address(gameHub));
        assertEq(pos.poolId, 1);
        assertEq(pos.asset, address(asset));
        assertEq(pos.bank, address(bank));
        assertEq(uint256(pos.state), uint256(SSOTTypes.PositionState.Held));
        assertEq(bank.totalReserved(), 10e6);

        SSOTTypes.Bet memory bet = gameHub.getBet(positionId);
        assertEq(uint256(bet.state), uint256(SSOTTypes.BetState.PendingVRF));
        assertEq(bet.asset, address(asset));
        assertEq(bet.bank, address(bank));
        SSOTTypes.BetTerminal memory terminal = gameHub.getBetTerminal(positionId);
        assertEq(uint256(terminal.state), uint256(SSOTTypes.BetState.None));

        uint256[] memory words = new uint256[](1);
        words[0] = 1;
        vrf.fulfillRandomWords(bet.requestId, words);
        gameHub.finalize(positionId);

        pos = router.getPosition(positionId);
        bet = gameHub.getBet(positionId);
        assertEq(uint256(pos.state), uint256(SSOTTypes.PositionState.Settled));
        assertEq(uint256(bet.state), uint256(SSOTTypes.BetState.Settled));
        terminal = gameHub.getBetTerminal(positionId);
        assertEq(uint256(terminal.state), uint256(SSOTTypes.BetState.Settled));
        assertEq(terminal.payoutGross, 10e6);
        assertEq(terminal.payoutNet, 9_800_000);
        assertEq(terminal.feeOnPayout, 200_000);
        // No referrer: the operator half of the 0.2 USDC turnover edge accrues as protocol fees; LPs keep the rest.
        assertEq(terminal.protocolFeeAccrual, 100_000);
        assertEq(terminal.refundAmount, 0);
        assertEq(bank.totalReserved(), 0);
        assertEq(bank.protocolFeesPayable(), 100_000);
        assertEq(asset.balanceOf(player), 99_800_000);
    }

    function test_refundCasinoBetThroughSettlementRouterAfterTimeout() external {
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10e6, betCount: 1, stopGain: 0, stopLoss: 0});
        (uint256 fee,) = gameHub.quoteVRFFee(spec.betCount);

        vm.prank(player);
        uint256 positionId = gameHub.placeBet{value: fee}(GAME_STAKE, 1, "", spec, address(0), 10_000);

        vm.warp(block.timestamp + gameHub.refundTimeoutSeconds());
        gameHub.refund(positionId);

        SSOTTypes.Position memory pos = router.getPosition(positionId);
        SSOTTypes.Bet memory bet = gameHub.getBet(positionId);
        SSOTTypes.BetTerminal memory terminal = gameHub.getBetTerminal(positionId);
        assertEq(uint256(pos.state), uint256(SSOTTypes.PositionState.Refunded));
        assertEq(uint256(bet.state), uint256(SSOTTypes.BetState.Refunded));
        assertEq(uint256(terminal.state), uint256(SSOTTypes.BetState.Refunded));
        assertEq(terminal.payoutGross, 0);
        assertEq(terminal.payoutNet, 0);
        assertEq(terminal.feeOnPayout, 0);
        assertEq(terminal.protocolFeeAccrual, 0);
        assertEq(terminal.refundAmount, 10e6);
        assertEq(bank.totalReserved(), 0);
        assertEq(asset.balanceOf(player), 100e6);
    }

    function test_inactivePoolBlocksGameHubRiskIn() external {
        vm.prank(gov);
        poolRegistry.setPoolActive(1, false);

        assertTrue(gameHub.riskInPaused(1));

        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10e6, betCount: 1, stopGain: 0, stopLoss: 0});
        (uint256 fee,) = gameHub.quoteVRFFee(spec.betCount);

        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(IGameHub.RiskInPaused.selector, uint64(1)));
        gameHub.placeBet{value: fee}(GAME_STAKE, 1, "", spec, address(0), 10_000);
    }

    function test_nonCasinoPoolRejectedEvenIfAllowedForGameHub() external {
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10e6, betCount: 1, stopGain: 0, stopLoss: 0});
        (uint256 fee,) = gameHub.quoteVRFFee(spec.betCount);

        vm.prank(player);
        vm.expectRevert(
            abi.encodeWithSelector(IGameHub.WrongPoolDomain.selector, uint64(2), SSOTTypes.PoolDomain.Sports)
        );
        gameHub.placeBet{value: fee}(GAME_STAKE, 2, "", spec, address(0), 10_000);
    }
}
