// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Bank} from "../../src/core/Bank.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {IGameHub} from "../../src/core/interfaces/IGameHub.sol";
import {IVRFHub} from "../../src/core/interfaces/IVRFHub.sol";
import {ILiquidityVaultBank} from "../../src/core/interfaces/ILiquidityVaultBank.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {CoinTossModule} from "../../src/modules/cointoss/CoinTossModule.sol";

interface IBaseSepoliaDirectWrapper {
    function s_vrfCoordinator() external view returns (address);
    function SUBSCRIPTION_ID() external view returns (uint256);
    function s_callbacks(uint256 requestId) external view returns (address, uint32, uint64);
    function getConfig()
        external
        view
        returns (int256, uint32, uint32, uint32, uint32, uint32, uint32, uint16, uint8, uint8, bytes32, uint8);
    function calculateRequestPriceNative(uint32 gasLimit, uint32 numWords) external view returns (uint256);
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata words) external;
}

interface IBaseSepoliaCoordinator {
    function s_requestCommitments(uint256 requestId) external view returns (bytes32);
    function s_config() external view returns (uint16, uint32, bool, uint32, uint32, uint32, uint32, uint8, uint8);
}

/// @notice Real archived wrapper/coordinator requests and USDC transfers, only on a local fork.
/// @dev Opt in: NFT_DIRECT_WRAPPER_FORK=true forge test --match-path test/fork/NftDirectWrapperFork.t.sol -vv
///      Optional NFT_FORK_RPC_URL defaults to https://sepolia.base.org. Disabled tests are explicitly SKIP.
///      No target overrides means the pinned historical Base Sepolia reference. A release gate must
///      supply all five NFT_FORK_{BLOCK_NUMBER,CHAIN_ID,WRAPPER,USDC,CALLBACK_GAS} values from its
///      authenticated snapshot and a fresh RPC block. This test does not authenticate that snapshot.
///      Fulfillment impersonates the deployed coordinator locally: this does NOT validate a VRF proof,
///      coordinator fulfillment billing, oracle availability, live network latency or all-game gas limits.
contract NftDirectWrapperForkTest is Test {
    uint256 private constant FORK_BLOCK = 47_638_466;
    address private constant WRAPPER = 0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed;
    address private constant COORDINATOR = 0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE;
    // Deployment evidence: deployments/latest-v16.json and docs/deploy/v16-sepolia-acceptance.md.
    address private constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address private constant GOV = address(0xA11CE);
    address private constant PLAYER = address(0xBEEF);
    uint32 private constant CALLBACK_GAS = 2_447_746;
    uint256 private constant LP_PRINCIPAL = 1_000e6;
    uint256 private constant PLAYER_CASH = 100e6;
    uint256 private constant STAKE = 1e6;
    bytes32 private constant GAME = keccak256("COIN");
    bytes32 private constant REQUEST_TOPIC =
        keccak256("RandomWordsRequested(bytes32,uint256,uint256,uint256,uint16,uint32,uint32,bytes,address)");

    IERC20Metadata private token;
    IBaseSepoliaDirectWrapper private wrapper;
    IBaseSepoliaCoordinator private coordinator;
    Bank private bank;
    LiquidityVault private vault;
    SettlementRouter private router;
    GameHub private hub;
    VRFHub private consumer;
    DefaultReferralEngine private engine;
    CoinTossModule private module;
    uint256 private preparedBet;
    uint48 private depositId;
    uint32 private selectedCallbackGas;
    uint32 private coordinatorCallbackGas;
    bytes32 private keyHash;

    modifier archivedFork() {
        vm.skip(!vm.envOr("NFT_DIRECT_WRAPPER_FORK", false), "requires NFT_DIRECT_WRAPPER_FORK=true and archive RPC");
        _;
    }

    function setUp() public {
        // Each test still explicitly skips when disabled; an enabled fork failure propagates.
        if (!vm.envOr("NFT_DIRECT_WRAPPER_FORK", false)) return;
        _initialize();
        vm.txGasPrice(1 gwei);
        preparedBet = this.prepareRequest(2 gwei);
        // Foundry commits setUp before the test transaction. Callback gas therefore includes clean
        // EIP-2200 storage costs; merely cooling dirty slots in the placement transaction would not.
    }

    function _initialize() private {
        bool referenceTarget = _selectForkTarget();
        assertGt(address(wrapper).code.length, 0);
        assertGt(address(token).code.length, 0);
        coordinator = IBaseSepoliaCoordinator(wrapper.s_vrfCoordinator());
        assertGt(address(coordinator).code.length, 0);
        assertEq(token.decimals(), 6);
        (,,,, uint32 overhead,,,,,, bytes32 configuredKeyHash,) = wrapper.getConfig();
        (, uint32 maxGas,,,,,,,) = coordinator.s_config();
        keyHash = configuredKeyHash;
        uint256 expandedGas = uint256(selectedCallbackGas) + selectedCallbackGas / 63 + 1 + overhead;
        assertLe(expandedGas, maxGas, "selected callback plus live wrapper overhead exceeds coordinator cap");
        coordinatorCallbackGas = uint32(expandedGas); // proven <= the coordinator's uint32 cap
        if (referenceTarget) {
            assertEq(address(coordinator), COORDINATOR);
            assertEq(overhead, 13_400);
            assertEq(maxGas, 2_500_000);
            assertGt(uint256(CALLBACK_GAS) + 1 + (uint256(CALLBACK_GAS) + 1) / 63 + 1 + overhead, maxGas);
        }

        PoolRegistry registry = new PoolRegistry(GOV);
        router = new SettlementRouter(address(registry));
        consumer = new VRFHub(address(wrapper), address(router));
        bank = new Bank(address(token), GOV, 1_000, 6, STAKE);
        vault = LiquidityVault(bank.vault());
        ReferralRegistry refs = new ReferralRegistry(GOV);
        engine = new DefaultReferralEngine();
        module = new CoinTossModule();
        hub = new GameHub(
            address(router), address(consumer), address(refs), address(engine), GOV, 1 hours, 200, 0, 0, 0, 0
        );
        vm.startPrank(GOV);
        bank.setSettlementRouterOnce(address(router));
        bank.setRandomnessConsumerOnce(address(consumer));
        registry.registerPool(1, address(token), address(bank), SSOTTypes.PoolDomain.Casino);
        registry.setHubRegistered(address(hub), true);
        registry.setHubAllowedForPool(1, address(hub), true);
        refs.setBinderOnce(address(hub));
        hub.registerGame(GAME, address(module), 1, selectedCallbackGas);
        vm.stopPrank();

        // Only local balances are injected. All protocol funding/payouts use the deployed USDC proxy.
        deal(address(token), GOV, LP_PRINCIPAL);
        deal(address(token), PLAYER, PLAYER_CASH);
        vm.deal(PLAYER, 1 ether);
        vm.startPrank(GOV);
        token.approve(address(vault), type(uint256).max);
        depositId = vault.addDeposit(LP_PRINCIPAL);
        vm.stopPrank();
        vm.prank(PLAYER);
        token.approve(address(hub), type(uint256).max);
        assertEq(token.balanceOf(address(vault)), LP_PRINCIPAL);
        assertEq(vault.nodeWithdrawView(depositId), LP_PRINCIPAL);
        assertEq(token.balanceOf(address(bank)), 0);
    }

    function _selectForkTarget() private returns (bool referenceTarget) {
        uint256 mask = (vm.envExists("NFT_FORK_BLOCK_NUMBER") ? 1 : 0) | (vm.envExists("NFT_FORK_CHAIN_ID") ? 2 : 0)
            | (vm.envExists("NFT_FORK_WRAPPER") ? 4 : 0) | (vm.envExists("NFT_FORK_USDC") ? 8 : 0)
            | (vm.envExists("NFT_FORK_CALLBACK_GAS") ? 16 : 0);
        require(mask == 0 || mask == 31, "provide all five NFT_FORK target overrides or none");
        referenceTarget = mask == 0;
        uint256 targetBlock = referenceTarget ? FORK_BLOCK : vm.envUint("NFT_FORK_BLOCK_NUMBER");
        uint256 targetChain = referenceTarget ? 84_532 : vm.envUint("NFT_FORK_CHAIN_ID");
        address targetWrapper = referenceTarget ? WRAPPER : vm.envAddress("NFT_FORK_WRAPPER");
        address targetAsset = referenceTarget ? USDC : vm.envAddress("NFT_FORK_USDC");
        uint256 targetGas = referenceTarget ? CALLBACK_GAS : vm.envUint("NFT_FORK_CALLBACK_GAS");
        require(targetBlock != 0 && targetChain != 0, "explicit nonzero fork identity required");
        require(targetGas != 0 && targetGas <= type(uint32).max, "invalid callback gas override");
        selectedCallbackGas = uint32(targetGas);
        vm.createSelectFork(vm.envOr("NFT_FORK_RPC_URL", string("https://sepolia.base.org")), targetBlock);
        assertEq(block.chainid, targetChain, "fork chain mismatch");
        assertEq(block.number, targetBlock, "fork block mismatch");
        token = IERC20Metadata(targetAsset);
        wrapper = IBaseSepoliaDirectWrapper(targetWrapper);
        emit log_named_string("fork target mode", referenceTarget ? "historical reference" : "explicit gate target");
        emit log_named_uint("fork chain", targetChain);
        emit log_named_uint("fork block", targetBlock);
        emit log_named_address("fork wrapper", targetWrapper);
        emit log_named_address("fork USDC", targetAsset);
        emit log_named_uint("consumer callback gas", targetGas);
    }

    function _spec() private pure returns (SSOTTypes.StakeSpec memory) {
        return SSOTTypes.StakeSpec(STAKE, 1, type(uint256).max, type(uint256).max);
    }

    /// @dev An external test-only boundary avoids optimizer inlining this proof into fixture deployment.
    function prepareRequest(uint256 budgetGasPrice) external returns (uint256 betId) {
        require(msg.sender == address(this), "fixture only");
        (uint256 budget, uint32 gasLimit) = hub.quoteVRFFee(GAME, 1, budgetGasPrice);
        uint256 actual = wrapper.calculateRequestPriceNative(selectedCallbackGas, 1);
        assertEq(gasLimit, selectedCallbackGas);
        uint256 playerNativeBefore = PLAYER.balance;
        uint256 wrapperNativeBefore = address(wrapper).balance;
        vm.recordLogs();
        vm.prank(PLAYER);
        betId = hub.placeBet{value: budget}(GAME, 1, abi.encode(true), _spec(), address(0), 200);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        SSOTTypes.Bet memory b = hub.getBet(betId);
        IVRFHub.RequestInfo memory r = consumer.getRequest(b.requestId);
        assertEq(uint8(r.state), uint8(IVRFHub.RequestState.Awaiting));
        assertEq(r.payer, PLAYER);
        assertEq(r.bank, address(bank));
        assertEq(r.hub, address(hub));
        assertEq(r.betId, betId);
        assertEq(r.feePaid, budget);
        assertEq(r.feeCharged, actual);
        assertEq(b.vrfFeeCharged, actual);
        assertEq(address(wrapper).balance - wrapperNativeBefore, actual);
        assertEq(playerNativeBefore - PLAYER.balance, actual, "overpayment returned directly to payer");
        assertEq(address(consumer).balance, 0);
        assertEq(address(hub).balance, 0);
        assertEq(consumer.totalRefundCredit(), 0);
        (address callback, uint32 callbackGas, uint64 requestGasPrice) = wrapper.s_callbacks(b.requestId);
        assertEq(callback, address(consumer));
        assertEq(callbackGas, selectedCallbackGas);
        assertEq(requestGasPrice, tx.gasprice);
        _assertCoordinatorRequest(logs, b.requestId);
        SSOTTypes.SSOT memory s = bank.getSSOT();
        assertTrue(s.accountingValid);
        assertEq(s.L, LP_PRINCIPAL, "pending stakes do not enter NFT capital");
        assertEq(s.P, STAKE);
        assertEq(s.R, 2 * STAKE);
        assertEq(s.K, STAKE);
        assertEq(s.G, LP_PRINCIPAL + STAKE);
        assertEq(s.bankCash, STAKE);
        assertEq(s.vaultCash, LP_PRINCIPAL);
        assertEq(token.balanceOf(PLAYER), PLAYER_CASH - STAKE);
        assertEq(token.balanceOf(address(hub)), 0);
        assertEq(token.allowance(address(hub), address(bank)), 0);
        emit log_named_uint("wrapper fee charged (wei)", actual);
    }

    function _assertCoordinatorRequest(Vm.Log[] memory logs, uint256 requestId) private view {
        uint256 matches;
        for (uint256 i; i < logs.length; ++i) {
            Vm.Log memory entry = logs[i];
            if (entry.emitter != address(coordinator) || entry.topics[0] != REQUEST_TOPIC) continue;
            ++matches;
            assertEq(entry.topics[1], keyHash);
            uint256 subId = uint256(entry.topics[2]);
            assertEq(subId, wrapper.SUBSCRIPTION_ID());
            assertEq(address(uint160(uint256(entry.topics[3]))), address(wrapper));
            (uint256 emittedId,, uint16 confirmations, uint32 callbackGas, uint32 words, bytes memory extraArgs) =
                abi.decode(entry.data, (uint256, uint256, uint16, uint32, uint32, bytes));
            assertEq(emittedId, requestId);
            assertEq(confirmations, 3);
            assertEq(callbackGas, coordinatorCallbackGas);
            assertEq(words, 1);
            assertEq(extraArgs, abi.encodeWithSelector(bytes4(keccak256("VRF ExtraArgsV1")), true));
            assertEq(
                coordinator.s_requestCommitments(requestId),
                keccak256(abi.encode(requestId, block.number, subId, callbackGas, words, address(wrapper), extraArgs)),
                "actual coordinator persisted request commitment"
            );
        }
        assertEq(matches, 1);
    }

    function _seed(uint256 betId, bool win) private view returns (uint256 seed) {
        uint256[] memory words = new uint256[](1);
        for (; seed < 64; ++seed) {
            words[0] = seed;
            (uint256 payout,) = module.resolve(abi.encode(true), _spec(), betId, words);
            if ((payout != 0) == win) return seed;
        }
        revert("local seed search exhausted");
    }

    function _fulfill(uint256 betId, uint256 seed) private {
        uint256 requestId = hub.getBet(betId).requestId;
        uint256[] memory words = new uint256[](1);
        words[0] = seed;
        // Remove warmth from the request/module reads above as well as all callback participants.
        vm.cool(address(token));
        vm.cool(address(wrapper));
        vm.cool(address(consumer));
        vm.cool(address(hub));
        vm.cool(address(router));
        vm.cool(address(bank));
        vm.cool(address(vault));
        vm.cool(address(engine));
        vm.cool(address(module));
        // The real wrapper authenticates the deployed coordinator; it then supplies exact callback gas.
        vm.prank(address(coordinator));
        uint256 before = gasleft();
        wrapper.rawFulfillRandomWords{gas: coordinatorCallbackGas}(requestId, words);
        emit log_named_uint("wrapper callback gas used (excludes coordinator proof/billing)", before - gasleft());
        (address callback,,) = wrapper.s_callbacks(requestId);
        assertEq(callback, address(0));
    }

    function _assertSettled(uint256 betId, uint256 seed, bool win) private view {
        uint256 requestId = hub.getBet(betId).requestId;
        assertEq(uint8(hub.getBet(betId).state), uint8(SSOTTypes.BetState.Settled));
        assertEq(uint8(router.getPosition(betId).state), uint8(SSOTTypes.PositionState.Settled));
        IVRFHub.RequestInfo memory r = consumer.getRequest(requestId);
        assertEq(uint8(r.state), uint8(IVRFHub.RequestState.Terminal));
        assertEq(r.seed, seed);
        assertEq(consumer.unbookedResultCount(address(bank)), 0);
        assertEq(bank.openHolds(), 0);
        SSOTTypes.BetTerminal memory receipt = hub.getBetTerminal(betId);
        uint256 payout = win ? 1_960_000 : 0;
        uint256 protocolFee = 10_000;
        assertEq(receipt.payoutGross, win ? 2 * STAKE : 0);
        assertEq(receipt.payoutNet, payout);
        assertEq(receipt.protocolFeeAccrual, protocolFee);
        SSOTTypes.SSOT memory s = bank.getSSOT();
        assertTrue(s.accountingValid);
        assertEq(s.L, LP_PRINCIPAL + STAKE - payout - protocolFee);
        assertEq(s.vaultCash, s.L);
        assertEq(vault.nodeWithdrawView(depositId), s.L);
        assertEq(s.bankCash, protocolFee);
        assertEq(s.PF, protocolFee);
        assertEq(s.P + s.R + s.K + s.XP + s.PP, 0);
        assertEq(s.bankSurplus + s.vaultSurplus, 0);
        assertEq(s.G, s.L);
        assertEq(token.balanceOf(PLAYER), PLAYER_CASH - STAKE + payout);
        assertEq(s.bankCash + s.vaultCash + token.balanceOf(PLAYER), LP_PRINCIPAL + PLAYER_CASH);
    }

    function testFork_actualGasPriceRefundsBudgetAndWinPaysRealUSDC() public archivedFork {
        uint256 bet = preparedBet;
        uint256 seed = _seed(bet, true);
        _fulfill(bet, seed);
        _assertSettled(bet, seed, true);
    }

    function testFork_lossMovesCashIntoTreeAndMatureOwnerWithdrawsRealUSDC() public archivedFork {
        uint256 bet = preparedBet;
        uint256 seed = _seed(bet, false);
        _fulfill(bet, seed);
        _assertSettled(bet, seed, false);
        uint256 expected = vault.getReserve();
        vm.warp(vault.withdrawAfter(depositId));
        assertEq(vault.depositState(depositId).maxAssets, expected);
        vm.prank(GOV);
        assertEq(vault.withdrawDeposit(depositId, 1e12), expected);
        assertEq(token.balanceOf(GOV), expected);
        assertEq(token.balanceOf(address(vault)), 0);
        assertEq(vault.getReserve(), 0);
        assertEq(vault.totalSupply(), 0);
        assertTrue(bank.getSSOT().accountingValid);
    }

    function testFork_failedDeliveryPersistsRealWrapperSeedUntilAccountingRetry() public archivedFork {
        uint256 bet = preparedBet;
        uint256 requestId = hub.getBet(bet).requestId;
        uint256 seed = _seed(bet, true);
        // Deliberate local delivery fault; token, wrapper and downstream accounting remain real.
        vm.mockCallRevert(address(hub), abi.encodeWithSelector(IGameHub.onRandomWords.selector), bytes("fault"));
        _fulfill(bet, seed);
        vm.clearMockedCalls();
        assertEq(uint8(consumer.getRequest(requestId).state), uint8(IVRFHub.RequestState.Received));
        assertEq(consumer.getRequest(requestId).seed, seed);
        assertEq(consumer.unbookedResultCount(address(bank)), 1);
        assertEq(uint8(vault.depositState(depositId).status), uint8(ILiquidityVaultBank.LPStatus.UnbookedResult));
        assertEq(bank.pendingStakeTotal(), STAKE);
        assertEq(token.balanceOf(address(bank)), STAKE);
        assertTrue(consumer.retry(requestId));
        _assertSettled(bet, seed, true);
    }

    function testFork_underfundedActualGasPriceRollsBackStakeAndReserve() public archivedFork {
        vm.txGasPrice(2 gwei);
        (uint256 lowBudget,) = hub.quoteVRFFee(GAME, 1, 1 gwei);
        uint256 required = wrapper.calculateRequestPriceNative(selectedCallbackGas, 1);
        assertLt(lowBudget, required);
        uint256 wrapperBefore = address(wrapper).balance;
        vm.prank(PLAYER);
        vm.expectRevert(abi.encodeWithSelector(IVRFHub.InsufficientVRFFee.selector, lowBudget, required));
        hub.placeBet{value: lowBudget}(GAME, 1, abi.encode(true), _spec(), address(0), 200);
        assertEq(address(wrapper).balance, wrapperBefore);
        assertEq(token.balanceOf(PLAYER), PLAYER_CASH - STAKE);
        assertEq(token.balanceOf(address(bank)), STAKE);
        assertEq(token.balanceOf(address(vault)), LP_PRINCIPAL);
        assertEq(bank.openHolds(), 1);
        assertEq(bank.pendingStakeTotal(), STAKE);
        assertEq(bank.totalReserved(), 2 * STAKE);
        assertEq(vault.lockedLiquidity(), STAKE);
        assertEq(uint8(hub.getBet(preparedBet).state), uint8(SSOTTypes.BetState.PendingVRF));
    }
}
