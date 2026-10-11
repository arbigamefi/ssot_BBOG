// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {IReferralRegistry} from "../../src/engines/referral/IReferralRegistry.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {IGameHub} from "../../src/core/interfaces/IGameHub.sol";
import {IGameModule} from "../../src/core/interfaces/IGameModule.sol";
import {ILiquidityVaultBank} from "../../src/core/interfaces/ILiquidityVaultBank.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {BaccaratModule} from "../../src/modules/baccarat/BaccaratModule.sol";
import {BaccaratParams} from "../../src/modules/baccarat/BaccaratParams.sol";
import {CoinTossModule} from "../../src/modules/cointoss/CoinTossModule.sol";
import {DiceModule} from "../../src/modules/dice/DiceModule.sol";
import {KenoModule} from "../../src/modules/keno/KenoModule.sol";
import {PlinkoModule} from "../../src/modules/plinko/PlinkoModule.sol";
import {PlinkoParams} from "../../src/modules/plinko/PlinkoParams.sol";
import {RouletteModule} from "../../src/modules/roulette/RouletteModule.sol";
import {RouletteParams} from "../../src/modules/roulette/RouletteParams.sol";
import {SicBoModule} from "../../src/modules/sicbo/SicBoModule.sol";
import {SicBoParams} from "../../src/modules/sicbo/SicBoParams.sol";
import {SlotsModule} from "../../src/modules/slots/SlotsModule.sol";
import {SlotsParams} from "../../src/modules/slots/SlotsParams.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";
import {Bank} from "../../src/core/Bank.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {IVRFHub} from "../../src/core/interfaces/IVRFHub.sol";
import {ExactGasWrapperFixture} from "../helpers/nft-callback/ExactGasWrapperFixture.sol";

/// @notice Real Bank/Vault/VRFHub/Hub integration and callback gas measurements.
/// @dev Wrapper transport and USDC-like token are local models; actual deployed-wrapper/token fork remains required.
contract NftCallbackIntegrationTest is Test {
    /// Binds through ReferralRegistry, which requires the player as caller (GameHub keeps no forwarder).
    function _bindReferrer(GameHub target, address player, address referrer) internal {
        IReferralRegistry referrals = IReferralRegistry(target.referralRegistry());
        vm.prank(player);
        referrals.bind(player, referrer);
    }

    address private constant GOV = address(0xA11CE);
    address private constant PLAYER = address(0xBEEF);
    uint256 private constant USDC = 1e6;
    uint256 private constant FIRST_LEAF = 1 << 40;
    BlacklistToken private token;
    Bank private bank;
    LiquidityVault private vault;
    PoolRegistry private registry;
    SettlementRouter private router;
    ExactGasWrapperFixture private wrapper;
    VRFHub private consumer;
    GameHub private hub;
    DefaultReferralEngine private engine;
    uint8 private preparedGame;
    uint32 private preparedRounds;
    bool private preparedBlacklist;
    bool private preparedIrregularTree;
    uint256 private preparedBetId;

    event CallbackCase(
        bytes32 indexed game,
        uint32 rounds,
        bool eligible,
        bool boundedSettled,
        uint256 successfulConsumerCallGas,
        uint256 boundedConsumerCallGas
    );

    function setUp() external {
        token = new BlacklistToken();
        registry = new PoolRegistry(GOV);
        router = new SettlementRouter(address(registry));
        wrapper = new ExactGasWrapperFixture();
        consumer = new VRFHub(address(wrapper), address(router));
        bank = new Bank(address(token), GOV, 1000, 6, 10_000);
        vault = LiquidityVault(bank.vault());
        vm.startPrank(GOV);
        bank.setSettlementRouterOnce(address(router));
        bank.setRandomnessConsumerOnce(address(consumer));
        bank.setMinPlayerTurnoverForUnlock(10_000 * USDC);
        vm.stopPrank();
        ReferralRegistry referrals = new ReferralRegistry(GOV);
        engine = new DefaultReferralEngine();
        hub = new GameHub(
            address(router),
            address(consumer),
            address(referrals),
            address(engine),
            GOV,
            3600,
            200,
            1000,
            2000,
            500,
            3000
        );
        vm.startPrank(GOV);
        registry.registerPool(1, address(token), address(bank), SSOTTypes.PoolDomain.Casino);
        registry.setHubRegistered(address(hub), true);
        registry.setHubAllowedForPool(1, address(hub), true);
        referrals.setBinderOnce(address(hub));
        hub.registerGame(keccak256("COIN_TOSS"), address(new CoinTossModule()), 25, 2_447_746);
        hub.registerGame(keccak256("DICE"), address(new DiceModule()), 25, 2_447_746);
        hub.registerGame(keccak256("ROULETTE"), address(new RouletteModule()), 25, 2_447_746);
        hub.registerGame(keccak256("KENO"), address(new KenoModule()), 25, 2_447_746);
        hub.registerGame(keccak256("SLOTS"), address(new SlotsModule()), 25, 2_447_746);
        hub.registerGame(keccak256("BACCARAT"), address(new BaccaratModule()), 25, 2_447_746);
        hub.registerGame(keccak256("PLINKO"), address(new PlinkoModule()), 25, 2_447_746);
        hub.registerGame(keccak256("SIC_BO"), address(new SicBoModule()), 25, 2_447_746);
        vm.stopPrank();
        _bindReferrer(hub, address(0xAA00), address(0xAA01));
        token.mint(GOV, 100_000 * USDC);
        token.mint(PLAYER, 100 * USDC);
        vm.prank(GOV);
        token.approve(address(vault), type(uint256).max);
        vm.prank(PLAYER);
        token.approve(address(hub), type(uint256).max);
        vm.deal(PLAYER, 100 ether);
        for (uint256 i; i < 16; ++i) {
            vm.prank(GOV);
            vault.addDeposit(1_000 * USDC);
        }
        vm.warp(block.timestamp + 1 days);
    }

    function test_eightModulesRepresentativeGasMatrix() external {
        uint256 base = vm.snapshotState();
        uint32[3] memory counts = [uint32(1), 10, 25];
        uint256 maximum;
        uint256 minimum = type(uint256).max;
        uint256 failures;
        for (uint8 game; game < 8; ++game) {
            for (uint256 countIndex; countIndex < counts.length; ++countIndex) {
                for (uint256 eligible; eligible < 2; ++eligible) {
                    (uint256 used, bool fit) = _matrixCase(game, counts[countIndex], eligible == 1);
                    maximum = used > maximum ? used : maximum;
                    minimum = used < minimum ? used : minimum;
                    if (!fit) ++failures;
                    assertTrue(vm.revertToState(base));
                }
            }
        }
        emit log_named_uint("same-test storage-dirty path screening minimum gas", minimum);
        emit log_named_uint("same-test storage-dirty path screening maximum gas", maximum);
        emit log_named_uint("integrated cases failing to settle within live-derived consumer ceiling (of 48)", failures);
        emit log_named_uint("live-derived consumer ceiling, not coordinator 2500000", wrapper.MAX_CONSUMER_GAS());
    }

    function _matrixCase(uint8 game, uint32 rounds, bool eligible) private returns (uint256 fullGas, bool fit) {
        vm.prank(GOV);
        bank.setMinPlayerTurnoverForUnlock(eligible ? 0 : 10_000 * USDC);
        (bytes32 id, bytes memory params) = _game(game);
        uint256 betId = _place(id, params, rounds);
        // Cutoff precedes new LPs. Existing prefix receives result; lazy-update paths must exclude new leaves.
        for (uint256 i; i < 8; ++i) {
            vm.prank(GOV);
            vault.addDeposit(1_000 * USDC);
        }
        uint256 requestId = hub.getBet(betId).requestId;
        uint256 checkpoint = vm.snapshotState();
        _cool(id);
        (bool delivered, uint256 boundedGas) = wrapper.deliver(requestId, 12345);
        assertTrue(delivered, "consumer must retain seed even when terminal attempt fails");
        IVRFHub.RequestInfo memory result = consumer.getRequest(requestId);
        assertTrue(result.state == IVRFHub.RequestState.Received || result.state == IVRFHub.RequestState.Terminal);
        assertEq(result.seed, 12345);
        fit = result.state == IVRFHub.RequestState.Terminal;
        if (!fit) _assertPendingAndFenced(betId);
        assertTrue(vm.revertToState(checkpoint));
        _cool(id);
        vm.recordLogs();
        (delivered, fullGas) = wrapper.diagnosticDelivery(requestId, 12345, 6_000_000);
        assertTrue(delivered, "diagnostic consumer call returned");
        _assertTerminal(betId);
        _assertThreeAwards(vm.getRecordedLogs());
        emit CallbackCase(id, rounds, eligible, fit, fullGas, boundedGas);
        emit log_named_uint(
            string.concat(
                "integrated ",
                _name(game),
                "/",
                vm.toString(rounds),
                eligible ? "/eligible" : "/locked",
                fit ? "/FIT" : "/OVER-BUDGET"
            ),
            fullGas
        );
    }

    function test_existingOneRoundCallbackPolicyIsInsufficientForNftSettlement() external {
        bytes32 underfunded = keccak256("UNDERFUNDED_DICE");
        address module = address(new DiceModule());
        vm.prank(GOV);
        hub.registerGame(underfunded, module, 1, 320_000);
        uint256 betId = _place(underfunded, abi.encode(true, uint8(50)), 1);
        uint256 requestId = hub.getBet(betId).requestId;
        _cool(keccak256("DICE"));
        (bool ok,) = wrapper.deliver(requestId, 12345);
        assertTrue(ok);
        _assertPendingAndFenced(betId);
        consumer.retry{gas: 6_000_000}(requestId);
        _assertTerminal(betId);
    }

    function test_deliveryFailureRetainsSeedAndFencesBothLpOperations() external {
        uint256 betId = _place(keccak256("DICE"), abi.encode(true, uint8(50)), 1);
        uint256 requestId = hub.getBet(betId).requestId;
        assertEq(hub.getBetRandomWords(betId).length, 0, "awaiting is not a zero seed");
        vm.mockCallRevert(
            address(hub), abi.encodeWithSelector(IGameHub.onRandomWords.selector), bytes("delivery failure")
        );
        _cool(keccak256("DICE"));
        (bool ok,) = wrapper.deliver(requestId, 0); // zero is a valid recorded seed.
        assertTrue(ok);
        _assertPendingAndFenced(betId);
        assertEq(uint256(hub.getBet(betId).state), uint256(SSOTTypes.BetState.PendingVRF));
        uint256[] memory canonical = hub.getBetRandomWords(betId);
        assertEq(canonical.length, 1, "view does not depend on a duplicate Hub receipt");
        assertEq(canonical[0], 0, "zero is a received seed");
        vm.clearMockedCalls();
        consumer.retry{gas: 6_000_000}(requestId);
        _assertTerminal(betId);
        IVRFHub.RequestInfo memory result = consumer.getRequest(requestId);
        assertEq(result.seed, 0);
        assertEq(uint256(result.state), uint256(IVRFHub.RequestState.Terminal));
        canonical = hub.getBetRandomWords(betId);
        assertEq(canonical.length, 1);
        assertEq(canonical[0], 0, "terminal view keeps original seed");
        assertEq(hub.getBet(betId).randomHash, keccak256(abi.encode(canonical)));
    }

    function test_callbackChildCannotAcceptAnExternallyChosenSeed() external {
        uint256 betId = _place(keccak256("DICE"), abi.encode(false, uint8(99)), 1);
        uint256 requestId = hub.getBet(betId).requestId;
        vm.expectRevert(IGameHub.NotSelf.selector);
        hub.finalizeFromCallback(betId, 999);

        vm.mockCallRevert(
            address(hub), abi.encodeWithSelector(IGameHub.onRandomWords.selector), bytes("delivery failure")
        );
        (bool delivered,) = wrapper.deliver(requestId, 0);
        assertTrue(delivered);
        vm.clearMockedCalls();
        _assertPendingAndFenced(betId);

        uint256[] memory forgedWords = new uint256[](1);
        forgedWords[0] = 999;
        vm.prank(address(consumer));
        vm.expectRevert(IGameHub.InvalidRandomReceipt.selector);
        hub.onRandomWords(requestId, forgedWords);
        vm.prank(address(consumer));
        vm.expectRevert(IGameHub.NotSelf.selector);
        hub.finalizeFromCallback(betId, 999);
        _assertPendingAndFenced(betId);
        assertEq(consumer.getRequest(requestId).seed, 0);

        consumer.retry{gas: 6_000_000}(requestId);
        _assertTerminal(betId);
        assertEq(hub.getBetRandomWords(betId)[0], 0);
    }

    /// @dev Boundary fault injection only: mock inconsistent consumer views to
    /// exercise Hub binding/state guards. This is not a reachable attack path.
    function test_canonicalReceiptRejectsWrongBindingsAndNonReceivedStates() external {
        uint256 betId = _place(keccak256("DICE"), abi.encode(false, uint8(99)), 1);
        uint256 requestId = hub.getBet(betId).requestId;
        vm.expectRevert(IGameHub.InvalidRandomReceipt.selector);
        hub.finalize(betId);
        assertEq(hub.getBetRandomWords(betId).length, 0);

        vm.mockCallRevert(
            address(hub), abi.encodeWithSelector(IGameHub.onRandomWords.selector), bytes("delivery failure")
        );
        (bool delivered,) = wrapper.deliver(requestId, 12345);
        assertTrue(delivered);
        vm.clearMockedCalls();
        _assertPendingAndFenced(betId);
        assertEq(uint256(hub.getBet(betId).state), uint256(SSOTTypes.BetState.PendingVRF));
        uint256 capitalBefore = vault.getReserve();
        uint256 playerCashBefore = token.balanceOf(PLAYER);
        uint256[] memory words = new uint256[](1);
        words[0] = 12345;

        // Each row changes exactly one bound identity; the other three are real.
        for (uint256 field; field < 4; ++field) {
            IVRFHub.RequestInfo memory altered = consumer.getRequest(requestId);
            if (field == 0) altered.hub = address(0xBAD1);
            else if (field == 1) altered.betId = betId + 1;
            else if (field == 2) altered.bank = address(0xBAD2);
            else altered.payer = address(0xBAD3);
            vm.mockCall(address(consumer), abi.encodeCall(IVRFHub.getRequest, (requestId)), abi.encode(altered));

            vm.expectRevert(IGameHub.InvalidRandomReceipt.selector);
            hub.getBetRandomWords(betId);
            vm.expectRevert(IGameHub.InvalidRandomReceipt.selector);
            hub.finalize(betId);
            vm.prank(address(consumer));
            vm.expectRevert(IGameHub.InvalidRandomReceipt.selector);
            hub.onRandomWords(requestId, words);
            vm.clearMockedCalls();
        }

        IVRFHub.RequestState[3] memory rejectedStates =
            [IVRFHub.RequestState.Awaiting, IVRFHub.RequestState.Terminal, IVRFHub.RequestState.Cancelled];
        for (uint256 i; i < rejectedStates.length; ++i) {
            IVRFHub.RequestInfo memory altered = consumer.getRequest(requestId);
            altered.state = rejectedStates[i];
            vm.mockCall(address(consumer), abi.encodeCall(IVRFHub.getRequest, (requestId)), abi.encode(altered));
            vm.expectRevert(IGameHub.InvalidRandomReceipt.selector);
            hub.finalize(betId);
            vm.prank(address(consumer));
            vm.expectRevert(IGameHub.InvalidRandomReceipt.selector);
            hub.onRandomWords(requestId, words);
            uint256[] memory visible = hub.getBetRandomWords(betId);
            if (rejectedStates[i] == IVRFHub.RequestState.Terminal) {
                assertEq(visible.length, 1, "terminal result remains readable");
                assertEq(visible[0], 12345);
            } else {
                assertEq(visible.length, 0, "unreceived/cancelled request has no result");
            }
            vm.clearMockedCalls();
        }

        _assertPendingAndFenced(betId);
        assertEq(vault.getReserve(), capitalBefore);
        assertEq(token.balanceOf(PLAYER), playerCashBefore);
        assertEq(consumer.getRequest(requestId).seed, 12345);
        assertTrue(consumer.retry{gas: 6_000_000}(requestId));
        _assertTerminal(betId);
        assertEq(hub.getBetRandomWords(betId)[0], 12345);
        vm.expectRevert(IGameHub.InvalidRandomReceipt.selector);
        hub.finalize(betId); // The actual terminal state cannot settle twice either.
    }

    function test_ackFailureRollsBackCashTreeHubRouterAndDebt() external {
        uint256 betId = _place(keccak256("COIN_TOSS"), abi.encode(true), 1);
        uint256 requestId = hub.getBet(betId).requestId;
        uint256 beforeRoot = vault.getReserve();
        uint256 beforePlayer = token.balanceOf(PLAYER);
        vm.mockCallRevert(address(consumer), abi.encodeWithSelector(IVRFHub.acknowledge.selector), bytes("ack failure"));
        _cool(keccak256("COIN_TOSS"));
        (bool ok,) = wrapper.diagnosticDelivery(requestId, 12345, 6_000_000);
        assertTrue(ok);
        _assertPendingAndFenced(betId);
        assertEq(vault.getReserve(), beforeRoot);
        assertEq(token.balanceOf(PLAYER), beforePlayer);
        assertEq(bank.protocolFeesPayable() + bank.externalPayablesTotal() + bank.playerPayableTotal(), 0);
        assertEq(bank.totalFeeOnPayout(), 0, "ack failure rolls back derived fee statistics");
        vm.clearMockedCalls();
        consumer.retry{gas: 6_000_000}(requestId);
        _assertTerminal(betId);
    }

    function test_receivedButUndeliveredSeedCannotTimeoutRefundAndPublicFinalizeHydratesIt() external {
        bytes32 gameId = keccak256("DICE");
        uint256 betId = _place(gameId, abi.encode(false, uint8(99)), 1);
        uint256 requestId = hub.getBet(betId).requestId;
        vm.mockCallRevert(address(hub), abi.encodeWithSelector(IGameHub.onRandomWords.selector), bytes("delivery"));
        (bool delivered,) = wrapper.deliver(requestId, 0);
        assertTrue(delivered);
        assertEq(uint256(hub.getBet(betId).state), uint256(SSOTTypes.BetState.PendingVRF));
        vm.clearMockedCalls();
        vm.warp(block.timestamp + 1 hours);
        vm.expectRevert(IGameHub.InvalidRandomReceipt.selector);
        hub.refund(betId);
        _assertPendingAndFenced(betId);
        hub.finalize(betId);
        _assertTerminal(betId);
        assertEq(consumer.getRequest(requestId).seed, 0);
    }

    function test_pauseAndAdmissionRevocationDoNotBlockExistingResult() external {
        uint256 betId = _place(keccak256("DICE"), abi.encode(false, uint8(99)), 1);
        vm.startPrank(GOV);
        bank.setRiskInPaused(true);
        registry.setPoolActive(1, false);
        registry.setHubAllowedForPool(1, address(hub), false);
        registry.setHubRegistered(address(hub), false);
        vm.stopPrank();
        (bool delivered,) = wrapper.deliver(hub.getBet(betId).requestId, 12345);
        assertTrue(delivered);
        _assertTerminal(betId);
        assertTrue(bank.riskInPaused());
    }

    function test_timeoutRefundCancelsTransportAndLateResultCannotChangeCapital() external {
        uint256 betId = _place(keccak256("DICE"), abi.encode(false, uint8(99)), 1);
        uint256 requestId = hub.getBet(betId).requestId;
        uint256 capital = vault.getReserve();
        vm.warp(block.timestamp + 1 hours);
        hub.refund(betId);
        assertEq(uint256(consumer.getRequest(requestId).state), uint256(IVRFHub.RequestState.Cancelled));
        assertEq(hub.getBetRandomWords(betId).length, 0, "cancelled has no random result");
        (bool delivered,) = wrapper.deliver(requestId, 12345);
        assertTrue(delivered);
        assertEq(vault.getReserve(), capital);
        assertEq(bank.pendingStakeTotal(), 0);
        assertEq(bank.openHolds(), 0);
        assertEq(consumer.unbookedResultCount(address(bank)), 0);
        assertEq(uint256(hub.getBet(betId).state), uint256(SSOTTypes.BetState.Refunded));
        assertEq(hub.getBetRandomWords(betId).length, 0, "late ignored word cannot appear in view");
    }

    function test_unboundedModuleRevertCannotEraseReceiptOrBecomeRefund() external {
        uint256 betId = _place(keccak256("DICE"), abi.encode(true, uint8(50)), 1);
        uint256 requestId = hub.getBet(betId).requestId;
        vm.mockCallRevert(hub.betModule(betId), abi.encodeWithSelector(IGameModule.resolve.selector), new bytes(65536));
        (bool delivered,) = wrapper.deliver(requestId, 12345);
        assertTrue(delivered);
        _assertPendingAndFenced(betId);
        vm.clearMockedCalls();
        hub.finalize(betId);
        _assertTerminal(betId);
    }

    function test_blacklistedWinnerBooksDebtWithoutBlockingTerminalOrSeedAck() external {
        bytes32 gameId = keccak256("DICE");
        bytes memory params = abi.encode(false, uint8(99));
        uint256 betId = _place(gameId, params, 25);
        uint256 requestId = hub.getBet(betId).requestId;
        token.setBlocked(PLAYER, true);
        _cool(gameId);
        (bool ok, uint256 used) = wrapper.diagnosticDelivery(requestId, 12345, 6_000_000);
        assertTrue(ok);
        _assertTerminal(betId);
        assertGt(bank.playerPayable(PLAYER), 0);
        assertEq(bank.playerPayable(PLAYER), hub.getBetTerminal(betId).payoutNet);
        emit log_named_uint("integrated blacklisted winner diagnostic consumer gas", used);
    }

    function test_unknownModuleFailureCannotBecomeRefund() external {
        bytes32 gameId = keccak256("DICE");
        uint256 betId = _place(gameId, abi.encode(true, uint8(50)), 1);
        uint256 requestId = hub.getBet(betId).requestId;
        vm.mockCallRevert(
            hub.gameModule(gameId),
            abi.encodeWithSelector(IGameModule.resolve.selector),
            abi.encodeWithSignature("Error(string)", "unknown failure")
        );
        _cool(gameId);
        (bool ok,) = wrapper.deliver(requestId, 12345);
        assertTrue(ok);
        _assertPendingAndFenced(betId);
        vm.clearMockedCalls();
        consumer.retry{gas: 6_000_000}(requestId);
        _assertTerminal(betId);
    }

    function test_expensivePlayerTransferCannotLoseSeedOrPartiallyBookSettlement() external {
        bytes32 gameId = keccak256("DICE");
        uint256 betId = _place(gameId, abi.encode(false, uint8(99)), 25);
        uint256 requestId = hub.getBet(betId).requestId;
        uint256 beforeRoot = vault.getReserve();
        token.setGasSink(PLAYER, 2_500_000);
        _cool(gameId);
        (bool ok,) = wrapper.deliver(requestId, 12345);
        assertTrue(ok);
        _assertPendingAndFenced(betId);
        assertEq(vault.getReserve(), beforeRoot);
        assertEq(bank.playerPayableTotal(), 0, "no partial debt booking");
        token.setGasSink(address(0), 0);
        consumer.retry{gas: 6_000_000}(requestId);
        _assertTerminal(betId);
    }

    function test_duplicateDeliveryCannotOverwriteSeedOrDoubleAcknowledge() external {
        bytes32 gameId = keccak256("DICE");
        uint256 betId = _place(gameId, abi.encode(false, uint8(99)), 25);
        uint256 requestId = hub.getBet(betId).requestId;
        (bool ok,) = wrapper.diagnosticDelivery(requestId, 12345, 6_000_000);
        assertTrue(ok);
        uint256[] memory words = new uint256[](1);
        words[0] = 999;
        wrapper.repeatFulfillment(address(consumer), requestId, words);
        _assertTerminal(betId);
        assertEq(consumer.getRequest(requestId).seed, 12345);
        assertEq(bank.totalBetsSettled(), 1);
    }

    function test_wrapperConsumerBudgetMatchesPinnedCoordinatorConstraint() external view {
        uint256 limit = wrapper.MAX_CONSUMER_GAS();
        assertEq(limit + limit / 63 + 1 + wrapper.WRAPPER_OVERHEAD(), wrapper.COORDINATOR_MAX_GAS());
        ++limit;
        assertGt(limit + limit / 63 + 1 + wrapper.WRAPPER_OVERHEAD(), wrapper.COORDINATOR_MAX_GAS());
    }

    /// @dev Called by the independent cold-case contracts ONLY during their setUp transaction.
    /// Moving placement and late deposits here also commits EIP-2200 original storage values. vm.cool
    /// alone clears EIP-2929 access warmth but cannot turn dirty slots into a new transaction baseline.
    function prepareColdCase(uint8 game, uint32 rounds, bool blacklist, bool irregularTree) external {
        require(preparedBetId == 0, "already prepared");
        preparedGame = game;
        preparedRounds = rounds;
        preparedBlacklist = blacklist;
        preparedIrregularTree = irregularTree;
        if (irregularTree) {
            vm.prank(GOV);
            vault.addDeposit(1_000 * USDC); // Seventeen old leaves: cutoff is not a power-of-two boundary.
            vm.warp(block.timestamp + 1 days);
            vm.prank(GOV);
            vault.withdrawDeposit(uint48(FIRST_LEAF + 5), 333_333_333_333);
        }
        (bytes32 gameId, bytes memory params) = _game(game);
        preparedBetId = _place(gameId, params, rounds);
        for (uint256 i; i < 8; ++i) {
            vm.prank(GOV);
            vault.addDeposit(1_000 * USDC);
        }
        if (blacklist) token.setBlocked(PLAYER, true);
    }

    /// @dev Called from the subsequent test transaction; every external state mutation is in setUp.
    function runPreparedColdCase() external returns (bool fit, uint256 fullGas) {
        uint256 betId = preparedBetId;
        (bytes32 gameId,) = _game(preparedGame);
        uint256 requestId = hub.getBet(betId).requestId;
        uint256 checkpoint = vm.snapshotState();
        _cool(gameId);
        (bool ok, uint256 boundedGas) = wrapper.deliver(requestId, 12345);
        assertTrue(ok, "bounded callback keeps canonical seed");
        fit = consumer.getRequest(requestId).state == IVRFHub.RequestState.Terminal;
        if (!fit) {
            _assertPendingAndFenced(betId);
            consumer.retry{gas: 6_000_000}(requestId);
            _assertTerminal(betId);
        }
        assertTrue(vm.revertToState(checkpoint));
        _cool(gameId);
        vm.recordLogs();
        (ok, fullGas) = wrapper.diagnosticDelivery(requestId, 12345, 6_000_000);
        assertTrue(ok, "diagnostic callback");
        _assertTerminal(betId);
        _assertThreeAwards(vm.getRecordedLogs());
        if (preparedBlacklist) assertGt(bank.playerPayable(PLAYER), 0, "failed payout booked to winner");
        emit CallbackCase(gameId, preparedRounds, false, fit, fullGas, boundedGas);
        emit log_named_uint(
            string.concat(
                "separate-setup cold ",
                _name(preparedGame),
                "/",
                vm.toString(preparedRounds),
                preparedIrregularTree ? "/17-old-partial" : "",
                preparedBlacklist ? "/blacklisted" : "",
                fit ? "/FIT" : "/OVER-BUDGET"
            ),
            fullGas
        );
    }

    function _place(bytes32 gameId, bytes memory params, uint32 count) private returns (uint256) {
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: USDC / count, betCount: count, stopGain: type(uint256).max, stopLoss: type(uint256).max
        });
        (uint256 fee,) = hub.quoteVRFFee(gameId, count, tx.gasprice);
        vm.prank(PLAYER);
        return hub.placeBet{value: fee}(gameId, 1, params, spec, address(0xAA00), 10_000);
    }

    function _assertPendingAndFenced(uint256 betId) private {
        SSOTTypes.BetState state = hub.getBet(betId).state;
        assertTrue(state == SSOTTypes.BetState.PendingVRF || state == SSOTTypes.BetState.RandomReady);
        assertEq(uint256(router.getPosition(betId).state), uint256(SSOTTypes.PositionState.Held));
        assertEq(bank.pendingStakeTotal(), USDC);
        assertEq(bank.totalBetsSettled(), 0);
        assertEq(consumer.unbookedResultCount(address(bank)), 1);
        bytes memory errorData =
            abi.encodeWithSelector(LiquidityVault.LPUnavailable.selector, ILiquidityVaultBank.LPStatus.UnbookedResult);
        vm.startPrank(GOV);
        vm.expectRevert(errorData);
        vault.addDeposit(USDC);
        vm.expectRevert(errorData);
        vault.withdrawDeposit(uint48(FIRST_LEAF), 1e12);
        vm.stopPrank();
    }

    function _assertTerminal(uint256 betId) private view {
        SSOTTypes.Bet memory bet = hub.getBet(betId);
        assertEq(uint256(bet.state), uint256(SSOTTypes.BetState.Settled));
        assertEq(uint256(router.getPosition(betId).state), uint256(SSOTTypes.PositionState.Settled));
        assertEq(bank.pendingStakeTotal(), 0);
        assertEq(bank.totalReserved(), 0);
        assertEq(vault.lockedLiquidity(), 0);
        assertEq(bank.totalBetsSettled(), 1);
        assertEq(consumer.unbookedResultCount(address(bank)), 0);
        assertEq(token.balanceOf(address(vault)), vault.getReserve());
        assertEq(
            token.balanceOf(address(bank)),
            bank.protocolFeesPayable() + bank.externalPayablesTotal() + bank.playerPayableTotal()
        );
        IVRFHub.RequestInfo memory result = consumer.getRequest(bet.requestId);
        assertEq(uint256(result.state), uint256(IVRFHub.RequestState.Terminal));
        uint256 seed = result.seed;
        uint256[] memory words = new uint256[](1);
        words[0] = seed;
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec(bet.amountPerRoll, bet.betCount, bet.stopGain, bet.stopLoss);
        (uint256 expectedGross, uint256 expectedRefund) =
            IGameModule(hub.gameModule(bet.gameId)).resolve(hub.getBetParams(betId), spec, betId, words);
        SSOTTypes.BetTerminal memory receipt = hub.getBetTerminal(betId);
        assertEq(receipt.payoutGross, expectedGross, "same seed module payout");
        assertEq(bank.totalFeeOnPayout(), receipt.feeOnPayout, "fee statistic includes paid or payable outcomes once");
        assertEq(receipt.refundAmount, expectedRefund, "module refund, never fallback refund");
        assertEq(receipt.payoutNet, expectedGross - expectedGross * bet.houseEdgeBps / 10_000);
        assertEq(bank.playerTurnover(PLAYER), bet.stake - expectedRefund);
        assertEq(
            bank.protocolFeesPayable() + bank.externalPayablesTotal(),
            ((bet.stake - expectedRefund) * bet.houseEdgeBps / 10_000) / 2,
            "real referral engine uses the complete turnover allocation"
        );
    }

    function _assertThreeAwards(Vm.Log[] memory logs) private view {
        bytes32 topic = keccak256("XPAwarded(uint256,address,address,uint256,uint256,uint256,bytes32)");
        uint256 n;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == address(bank) && logs[i].topics[0] == topic) ++n;
        }
        assertEq(n, 3, "L0 rakeback and two referral tiers");
    }

    function _cool(bytes32 gameId) private {
        address module = hub.gameModule(gameId);
        vm.cool(address(token));
        vm.cool(address(vault));
        vm.cool(address(bank));
        vm.cool(address(hub));
        vm.cool(address(router));
        vm.cool(address(consumer));
        vm.cool(address(wrapper));
        vm.cool(address(engine));
        vm.cool(module);
    }

    function _game(uint8 index) private pure returns (bytes32 gameId, bytes memory params) {
        if (index == 0) return (keccak256("COIN_TOSS"), abi.encode(true));
        if (index == 1) return (keccak256("DICE"), abi.encode(false, uint8(99)));
        if (index == 2) return (keccak256("ROULETTE"), RouletteParams.encode(RouletteParams.Kind.High, 0));
        if (index == 3) return (keccak256("KENO"), abi.encode(uint40(31)));
        if (index == 4) return (keccak256("SLOTS"), SlotsParams.encode(SlotsParams.PROFILE_CLASSIC));
        if (index == 5) return (keccak256("BACCARAT"), BaccaratParams.encode(BaccaratParams.SIDE_BANKER));
        if (index == 6) return (keccak256("PLINKO"), PlinkoParams.encode(PlinkoParams.RISK_MEDIUM));
        return (keccak256("SIC_BO"), SicBoParams.encode(SicBoParams.KIND_TOTAL, 10));
    }

    function _name(uint8 index) private pure returns (string memory) {
        string[8] memory names = ["COIN_TOSS", "DICE", "ROULETTE", "KENO", "SLOTS", "BACCARAT", "PLINKO", "SIC_BO"];
        return names[index];
    }
}

/// @dev The outer test runner executes setUp before the test, so all position, tree, token allowance and
/// reserve writes predate the measured transaction. This avoids the dirty-slot discount of matrix loops.
abstract contract NftColdCallbackBase is Test {
    NftCallbackIntegrationTest private fixture;
    function gameIndex() internal pure virtual returns (uint8);

    function rounds() internal pure virtual returns (uint32) {
        return 25;
    }

    function blacklistWinner() internal pure virtual returns (bool) {
        return false;
    }

    function irregularTree() internal pure virtual returns (bool) {
        return false;
    }

    function setUp() external {
        fixture = new NftCallbackIntegrationTest();
        fixture.setUp();
        fixture.prepareColdCase(gameIndex(), rounds(), blacklistWinner(), irregularTree());
    }

    function test_separateSetupColdFullCallback() external {
        fixture.runPreparedColdCase();
    }
}

contract NftColdCoinCallbackTest is NftColdCallbackBase {
    function gameIndex() internal pure override returns (uint8) {
        return 0;
    }
}

contract NftColdDiceCallbackTest is NftColdCallbackBase {
    function gameIndex() internal pure override returns (uint8) {
        return 1;
    }
}

contract NftColdRouletteCallbackTest is NftColdCallbackBase {
    function gameIndex() internal pure override returns (uint8) {
        return 2;
    }
}

contract NftColdKenoCallbackTest is NftColdCallbackBase {
    function gameIndex() internal pure override returns (uint8) {
        return 3;
    }
}

contract NftColdSlotsCallbackTest is NftColdCallbackBase {
    function gameIndex() internal pure override returns (uint8) {
        return 4;
    }
}

contract NftColdBaccaratCallbackTest is NftColdCallbackBase {
    function gameIndex() internal pure override returns (uint8) {
        return 5;
    }
}

contract NftColdPlinkoCallbackTest is NftColdCallbackBase {
    function gameIndex() internal pure override returns (uint8) {
        return 6;
    }
}

contract NftColdSicBoCallbackTest is NftColdCallbackBase {
    function gameIndex() internal pure override returns (uint8) {
        return 7;
    }
}

contract NftColdBlacklistedDiceCallbackTest is NftColdCallbackBase {
    function gameIndex() internal pure override returns (uint8) {
        return 1;
    }

    function blacklistWinner() internal pure override returns (bool) {
        return true;
    }
}

contract NftColdIrregularKeno25CallbackTest is NftColdCallbackBase {
    function gameIndex() internal pure override returns (uint8) {
        return 3;
    }

    function rounds() internal pure override returns (uint32) {
        return 25;
    }

    function irregularTree() internal pure override returns (bool) {
        return true;
    }
}
