// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {BankRegistry} from "../../src/core/BankRegistry.sol";
import {Hub} from "../../src/core/Hub.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {IGameModule} from "../../src/core/interfaces/IGameModule.sol";
import {IHub} from "../../src/core/interfaces/IHub.sol";
import {IVRFHub} from "../../src/core/interfaces/IVRFHub.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {Errors} from "../../src/libs/Errors.sol";

contract SecurityStakePayoutModule is IGameModule {
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

contract SecurityRefundTooLargeModule is IGameModule {
    function validate(bytes calldata, SSOTTypes.StakeSpec calldata stakeSpec) external pure {
        require(stakeSpec.amountPerRoll > 0 && stakeSpec.betCount > 0, "bad spec");
    }

    function maxPayout(bytes calldata, SSOTTypes.StakeSpec calldata stakeSpec) external pure returns (uint256) {
        return stakeSpec.amountPerRoll * uint256(stakeSpec.betCount) + 1;
    }

    function resolve(bytes calldata, SSOTTypes.StakeSpec calldata stakeSpec, uint256, uint256[] calldata)
        external
        pure
        returns (uint256 payoutGross, uint256 refundAmount)
    {
        payoutGross = 0;
        refundAmount = stakeSpec.amountPerRoll * uint256(stakeSpec.betCount) + 1;
    }
}

contract SecurityFixes is Test {
    event BetReserveReleased(uint256 indexed betId, address indexed player, uint256 reserved);

    bytes32 internal constant GAME_STAKE = keccak256("SECURITY_STAKE");
    bytes32 internal constant GAME_BAD_REFUND = keccak256("SECURITY_BAD_REFUND");

    address internal gov = address(0xA11CE);
    address internal player = address(0xBEEF);
    address internal affiliate = address(0xAFF1);

    function test_firstLpInflationAttackNoLongerProfitable() external {
        MockERC20 asset = new MockERC20("USDC", "USDC", 6);
        Bank bank = new Bank(address(asset), gov, 0, "B", "B", 6);

        address attacker = address(0xA);
        address victim = address(0xB);
        uint256 donation = 1_000_000e6;
        asset.mint(attacker, donation + 1);
        asset.mint(victim, 100e6);

        vm.startPrank(attacker);
        asset.approve(address(bank), type(uint256).max);
        bank.deposit(1, attacker);
        asset.transfer(address(bank), donation);
        vm.stopPrank();

        vm.startPrank(victim);
        asset.approve(address(bank), type(uint256).max);
        uint256 victimShares = bank.deposit(100e6, victim);
        vm.stopPrank();

        assertGt(victimShares, 0, "victim deposit must not mint zero shares");

        vm.prank(attacker);
        uint256 swept = bank.redeem(1, attacker, attacker);
        assertLt(swept, donation + 1, "attacker must not profit from direct donation inflation");
        assertLt(swept, 2e6, "virtual reserve should capture almost all donated value");
    }

    function test_referralConfigRejectsOverBudgetLevels() external {
        uint16[6] memory initialLevels;
        (,, Hub hub,) = _deploy(initialLevels, 0, 0, 200, 0);

        uint16[6] memory badLevels;
        badLevels[0] = 5_000;
        badLevels[1] = 5_001;

        vm.prank(gov);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidBps.selector, 10_001));
        hub.createReferralConfig(10_000, 0, 0, badLevels, 2);
    }

    function test_initialReferralConfigRejectsOverBudgetLevels() external {
        MockERC20 asset = new MockERC20("Asset", "AST", 18);
        Bank bank = new Bank(address(asset), gov, 0, "LP", "LP", 18);
        BankRegistry registry = new BankRegistry(gov);
        VRFHub vrf = new VRFHub(address(this), gov);
        ReferralRegistry refReg = new ReferralRegistry(gov);
        DefaultReferralEngine refEng = new DefaultReferralEngine();
        vm.prank(gov);
        registry.registerBank(address(asset), address(bank));

        uint16[6] memory badLevels;
        badLevels[1] = 30_000;

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidBps.selector, 30_000));
        new Hub(
            address(registry),
            address(vrf),
            address(refReg),
            address(refEng),
            gov,
            3600,
            200,
            0,
            10_000,
            0,
            0,
            badLevels,
            2
        );
    }

    function test_zeroMaxAffiliateDeltaMeansDefaultOnly() external {
        uint16[6] memory levels;
        (MockERC20 asset, Bank bank, Hub hub, VRFHub vrf) = _deploy(levels, 0, 0, 200, 0);

        vm.prank(affiliate);
        vm.expectRevert(abi.encodeWithSelector(IHub.HouseEdgeTooHigh.selector, 201, 200));
        hub.setAffiliateHouseEdge(201);

        vm.prank(affiliate);
        hub.setAffiliateHouseEdge(200);

        SecurityStakePayoutModule module = new SecurityStakePayoutModule();
        vm.prank(gov);
        hub.registerGame(GAME_STAKE, address(module));

        asset.mint(player, 10 ether);
        vm.deal(player, 10 ether);
        vm.prank(player);
        asset.approve(address(bank), type(uint256).max);

        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});
        (uint256 fee,) = hub.quoteVRFFee(1);

        vm.prank(player);
        uint256 betId = hub.placeBet{value: fee}(GAME_STAKE, address(asset), "", spec, affiliate, 0);

        SSOTTypes.Bet memory b = hub.getBet(betId);
        assertEq(b.maxHouseEdgeBps, 200, "user maxHouseEdgeBps=0 should mean default HE");
        assertEq(b.effectiveHouseEdgeBps, 200, "effective HE should stay at default");

        uint256[] memory words = new uint256[](1);
        words[0] = 1;
        vrf.fulfillRandomWords(b.requestId, words);
        hub.finalize(betId);

        assertEq(asset.balanceOf(player), 98 ether / 10, "player should receive 98% net payout");
    }

    function test_badModuleRefundTooLargeFallsBackToFullRefund() external {
        uint16[6] memory levels;
        (MockERC20 asset, Bank bank, Hub hub, VRFHub vrf) = _deploy(levels, 0, 0, 200, 0);

        SecurityRefundTooLargeModule module = new SecurityRefundTooLargeModule();
        vm.prank(gov);
        hub.registerGame(GAME_BAD_REFUND, address(module));

        asset.mint(player, 10 ether);
        vm.deal(player, 10 ether);
        vm.prank(player);
        asset.approve(address(bank), type(uint256).max);

        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});
        (uint256 fee,) = hub.quoteVRFFee(1);

        vm.prank(player);
        uint256 betId = hub.placeBet{value: fee}(GAME_BAD_REFUND, address(asset), "", spec, address(0), 10_000);

        SSOTTypes.Bet memory b = hub.getBet(betId);
        uint256[] memory words = new uint256[](1);
        words[0] = 1;
        vrf.fulfillRandomWords(b.requestId, words);

        hub.finalize(betId);

        b = hub.getBet(betId);
        assertEq(uint256(b.state), uint256(SSOTTypes.BetState.Refunded), "invalid module output should debt-out refund");
        assertEq(asset.balanceOf(player), 10 ether, "player stake should be returned");
        assertEq(bank.totalReserved(), 0, "reserved capital should be released");
    }

    function test_newHoldbackAwardDoesNotDelayExistingVesting() external {
        MockERC20 asset = new MockERC20("Asset", "AST", 18);
        Bank bank = new Bank(address(asset), gov, 0, "LP", "LP", 18);
        address payee = address(0xCAFE);

        vm.prank(gov);
        bank.setSettlementRouterOnce(address(this));

        asset.mint(player, 200 ether);
        vm.prank(player);
        asset.approve(address(bank), type(uint256).max);

        uint256 t0 = 1_000_000;
        vm.warp(t0);
        _settleDirectHoldback(bank, 1, player, payee, 100 ether);

        vm.warp(t0 + 15 days);
        _settleDirectHoldback(bank, 2, player, payee, 100 ether);

        assertEq(bank.xpAccruedOf(payee), 50 ether, "first schedule should release its midpoint before new award");
        assertEq(bank.xpHoldbackOf(payee), 150 ether, "remaining old and new holdback stay tracked");

        vm.warp(t0 + 30 days);
        bank.syncXPHoldback(payee);

        assertEq(bank.xpAccruedOf(payee), 200 ether, "new award must not extend the active vesting end");
        assertEq(bank.xpHoldbackOf(payee), 0, "aggregate schedule should fully release at original end");
    }

    function test_duplicateBindReferrerReverts() external {
        uint16[6] memory levels;
        (,, Hub hub,) = _deploy(levels, 0, 0, 200, 0);

        vm.prank(player);
        hub.bindReferrer(affiliate);
        assertEq(hub.referrerOf(player), affiliate, "first touch should bind");

        vm.prank(player);
        vm.expectRevert(Errors.InvalidConfig.selector);
        hub.bindReferrer(address(0xB0B));
        assertEq(hub.referrerOf(player), affiliate, "duplicate bind must not mutate first touch");
    }

    function test_detachClearsRequestStorage() external {
        VRFHub vrf = new VRFHub(address(this), gov);
        uint32 cbGas = 200_000;
        uint16 conf = 3;
        uint32 words = 1;
        uint256 required = vrf.quote(cbGas, conf, words);

        (uint256 requestId,) = vrf.requestRandomWords{value: required}(address(this), 123, cbGas, conf, words, player);

        IVRFHub.RequestInfo memory beforeDetach = vrf.getRequest(requestId);
        assertEq(beforeDetach.hub, address(this), "request should be stored");
        assertTrue(beforeDetach.active, "request should start active");

        vrf.detach(requestId);

        IVRFHub.RequestInfo memory afterDetach = vrf.getRequest(requestId);
        assertEq(afterDetach.hub, address(0), "request hub should be cleared");
        assertEq(afterDetach.betId, 0, "request betId should be cleared");
        assertEq(afterDetach.payer, address(0), "request payer should be cleared");
        assertFalse(afterDetach.active, "request should be inactive");
    }

    function test_refundBetEmitsReleasedReserve() external {
        MockERC20 asset = new MockERC20("Asset", "AST", 18);
        Bank bank = new Bank(address(asset), gov, 0, "LP", "LP", 18);

        vm.prank(gov);
        bank.setSettlementRouterOnce(address(this));

        asset.mint(player, 10 ether);
        vm.prank(player);
        asset.approve(address(bank), type(uint256).max);

        bank.holdBet(77, player, 10 ether, 10 ether, bytes32(uint256(77)));

        vm.expectEmit(true, true, false, true, address(bank));
        emit BetReserveReleased(77, player, 10 ether);
        bank.refundBet(77, 10 ether);

        assertEq(bank.totalReserved(), 0, "reserve should be released");
        assertEq(asset.balanceOf(player), 10 ether, "stake should be refunded");
    }

    function _deploy(
        uint16[6] memory levels,
        uint16 baseBudgetBps,
        uint16 deltaBudgetBps,
        uint16 defaultHE,
        uint16 maxAffiliateDelta
    ) internal returns (MockERC20 asset, Bank bank, Hub hub, VRFHub vrf) {
        asset = new MockERC20("Asset", "AST", 18);
        bank = new Bank(address(asset), gov, 0, "LP", "LP", 18);
        BankRegistry registry = new BankRegistry(gov);
        vrf = new VRFHub(address(this), gov);
        ReferralRegistry refReg = new ReferralRegistry(gov);
        DefaultReferralEngine refEng = new DefaultReferralEngine();

        vm.prank(gov);
        registry.registerBank(address(asset), address(bank));

        hub = new Hub(
            address(registry),
            address(vrf),
            address(refReg),
            address(refEng),
            gov,
            3600,
            defaultHE,
            maxAffiliateDelta,
            baseBudgetBps,
            deltaBudgetBps,
            0,
            levels,
            2
        );

        vm.startPrank(gov);
        bank.setSettlementRouterOnce(address(hub));
        refReg.setBinderOnce(address(hub));
        vm.stopPrank();

        asset.mint(gov, 1_000_000 ether);
        vm.startPrank(gov);
        asset.approve(address(bank), type(uint256).max);
        bank.deposit(1_000_000 ether, gov);
        vm.stopPrank();
    }

    function _settleDirectHoldback(Bank bank, uint256 betId, address player_, address payee, uint256 amount) internal {
        bank.holdBet(betId, player_, amount, amount, bytes32(betId));

        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](1);
        awards[0] = SSOTTypes.XPAward({
            payee: payee,
            sourcePlayer: address(0),
            accrued: 0,
            locked: 0,
            holdback: amount,
            reason: keccak256("SECURITY_HOLDBACK")
        });

        bank.settleBet(betId, 0, 0, 0, 0, awards);
    }
}
