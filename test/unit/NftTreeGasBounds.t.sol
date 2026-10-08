// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {Bank} from "../../src/core/Bank.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {IReferralEngine} from "../../src/engines/referral/IReferralEngine.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";
import {AzuroTreeHarness} from "../helpers/azuro-tree/AzuroTreeHarness.sol";

/// @dev Only the canonical seed-read interface is stubbed; no randomness/VRF gas claim is made here.
contract TreeGasResultAuthority {
    address public immutable settlementRouter;

    constructor(address router) {
        settlementRouter = router;
    }

    function unbookedResultCount(address) external pure returns (uint256) {
        return 0;
    }
}

/// @notice Except the explicitly named synthetic descendant, all history uses production APIs.
/// @dev setUp commits the complete history before either measured test transaction. Measurements
///      cover Router -> Bank -> Vault and a model token, NOT the full consumer/Hub/module/referral path.
abstract contract NftReachableTreeGasBase is Test {
    uint48 internal constant FIRST = uint48(1) << 40;
    uint40 internal constant ONE = 1e12;
    uint256 internal constant DEPOSIT = 1_000e6;
    uint256 internal constant STAKE = 200e6;
    uint256 internal constant RESERVE = 600e6;
    address internal constant OWNER = address(0xA11CE);
    address internal constant PLAYER = address(0xBEEF);

    enum History {
        Fresh,
        Lazy32,
        ThinPrefix,
        EmptyPrefix,
        EmptyRoot,
        SparseBoundary,
        SparseBoundaryLazy
    }

    BlacklistToken internal token;
    Bank internal bank;
    LiquidityVault internal vault;
    SettlementRouter internal router;
    DefaultReferralEngine internal referralEngine;
    uint256 internal position;
    uint256 internal beforeRoot;
    uint256 internal beforePlayer;
    uint256 internal beforeFees;
    uint256 internal terminalMaximum;

    function config() internal pure virtual returns (uint256 oldCount, uint256 lateCount, History history);
    function label() internal pure virtual returns (string memory);

    function syntheticBoundary() internal pure virtual returns (bool) {
        return false;
    }

    function awardCount() internal pure virtual returns (uint256) {
        return 0;
    }

    function setUp() public {
        (uint256 oldCount, uint256 lateCount, History history) = config();
        token = new BlacklistToken();
        PoolRegistry registry = new PoolRegistry(address(this));
        router = new SettlementRouter(address(registry));
        TreeGasResultAuthority authority = new TreeGasResultAuthority(address(router));
        bank = new Bank(address(token), address(this), 1_000, 6, 1);
        referralEngine = new DefaultReferralEngine();
        if (awardCount() != 0) bank.setMinPlayerTurnoverForUnlock(10_000e6);
        vault = LiquidityVault(bank.vault());
        bank.setSettlementRouterOnce(address(router));
        bank.setRandomnessConsumerOnce(address(authority));
        registry.registerPool(1, address(token), address(bank), SSOTTypes.PoolDomain.Casino);
        registry.setHubRegistered(address(this), true);
        registry.setHubAllowedForPool(1, address(this), true);
        token.mint(OWNER, (oldCount + lateCount) * DEPOSIT);
        token.mint(address(this), 1_000_000e6);
        token.approve(address(bank), type(uint256).max);
        vm.prank(OWNER);
        token.approve(address(vault), type(uint256).max);
        // Only fixture construction is unmetered: thousands of independent historic transactions
        // are compressed into setUp. The measured terminal is a separate fully metered transaction.
        vm.pauseGasMetering();
        if (syntheticBoundary()) {
            // Explicit state compression, NOT an executed 2^40-deposit history. LiquidityTree's first
            // packed slot is (nextNode:uint48, updateId:uint64). Keep all other storage untouched.
            uint256 skipped = uint256(FIRST) - 2;
            uint64 simulatedUpdates = uint64(1 + 3 * skipped);
            uint256 packed = uint256(FIRST * 2 - 2) | (uint256(simulatedUpdates) << 48);
            vm.store(address(vault), bytes32(0), bytes32(packed));
            assertEq(vault.nextNode(), FIRST * 2 - 2);
            assertEq(vault.updateId(), simulatedUpdates);
        }
        _deposits(oldCount);
        if (history == History.SparseBoundary || history == History.SparseBoundaryLazy) {
            // Real mint/burn history: only the final old leaf survives. No counter or storage injection.
            vm.warp(block.timestamp + 1 days);
            vm.startPrank(OWNER);
            for (uint256 i; i + 1 < oldCount; ++i) {
                vault.withdrawDeposit(FIRST + uint48(i), ONE);
            }
            vm.stopPrank();
        }
        if (history == History.Lazy32) {
            for (uint256 i; i < 32; ++i) {
                uint256 prior = router.openPosition(1, PLAYER, STAKE, RESERVE, bytes32(i), 0);
                uint256 cost = i % 2 == 0 ? RESERVE : 0;
                router.settlePosition(prior, cost, cost, 0, 0, new SSOTTypes.XPAward[](0));
            }
        }
        terminalMaximum = history == History.EmptyRoot ? STAKE : RESERVE;
        position =
            router.openPosition(1, PLAYER, STAKE, terminalMaximum, bytes32("gas-target"), awardCount() == 0 ? 0 : 500);
        (,,, uint48 cutoff, bool open) = bank.holds(position);
        assertTrue(open);
        assertEq(cutoff, syntheticBoundary() ? FIRST * 2 - 2 : FIRST + oldCount - 1);
        _deposits(lateCount);
        if (history == History.SparseBoundaryLazy) {
            // A later position profits across both surviving leaves, leaving lower tree nodes lazy.
            // The casino award witness also uses an un-referred player's ordinary 2x/2%-edge bet.
            bool casinoFees = awardCount() != 0;
            uint256 prior = router.openPosition(
                1, address(0xCAFE), STAKE, casinoFees ? 2 * STAKE : STAKE, bytes32("root-lazy"), casinoFees ? 200 : 0
            );
            uint256 priorFee = casinoFees ? STAKE * 200 / 10_000 / 2 : 0;
            router.settlePosition(prior, 0, 0, 0, priorFee, new SSOTTypes.XPAward[](0));
        }
        if (history == History.ThinPrefix || history == History.EmptyPrefix || history == History.EmptyRoot) {
            vm.warp(block.timestamp + 1 days);
            vm.startPrank(OWNER);
            for (uint256 i; i < oldCount; ++i) {
                uint40 percent = history == History.ThinPrefix && i == 0 ? ONE - 1 : ONE;
                vault.withdrawDeposit(FIRST + uint48(i), percent);
            }
            vm.stopPrank();
            assertEq(vault.nodeWithdrawView(FIRST), history == History.ThinPrefix ? 1 : 0);
        }
        beforeRoot = vault.getReserve();
        beforePlayer = token.balanceOf(PLAYER);
        beforeFees = bank.protocolFeesPayable();
        vm.resumeGasMetering();
        assertTrue(bank.getSSOT().accountingValid);
    }

    function _deposits(uint256 count) private {
        vm.startPrank(OWNER);
        for (uint256 i; i < count; ++i) {
            vault.addDeposit(DEPOSIT);
        }
        vm.stopPrank();
    }

    function test_coldProductionProfit() public {
        _measure(0, false);
    }

    function test_coldProductionMaximumCost() public {
        _measure(terminalMaximum, false);
    }

    function _measure(uint256 cost, bool boundedOnly) internal {
        uint256 n = awardCount();
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](n);
        uint256 fee;
        if (n != 0) {
            IReferralEngine.AllocationInput memory input = IReferralEngine.AllocationInput({
                usedTurnover: STAKE,
                houseEdgeBps: 500,
                player: PLAYER,
                l1: address(0xD001),
                l2: address(0xD002),
                l0Bps: 1_000,
                l1Bps: 2_000,
                l2Bps: 500,
                holdbackBps: 3_000,
                minTurnover: 10_000e6,
                playerTurnover: STAKE
            });
            IReferralEngine.Allocation memory allocation;
            (allocation, awards) = referralEngine.allocate(input);
            fee = allocation.protocolFee;
            assertEq(awards.length, 3);
        }
        uint256 xp;
        for (uint256 i; i < n; ++i) {
            xp += awards[i].accrued + awards[i].locked + awards[i].holdback;
        }
        // Match GameHub fee-on-payout and the actual engine's turnover allocation.
        uint256 payout = n == 0 ? cost : cost - cost * 500 / 10_000;
        uint256 actualCost = payout + fee + xp;
        _coolAccounting();
        vm.record();
        uint256 begin = gasleft();
        uint256 used;
        if (boundedOnly) {
            assertTrue(syntheticBoundary());
            (bool fits,) = address(router).call{gas: 2_447_746}(
                abi.encodeCall(router.settlePosition, (position, cost, payout, 0, fee, awards))
            );
            used = begin - gasleft();
            // This admits only the fixed accounting segment of a synthetic tree shape, not a full callback.
            assertTrue(fits, "three-award fixed accounting must fit the supplied consumer-wide budget");
            emit log_named_uint("fixed accounting supplied gas budget, NOT callback qualification", 2_447_746);
        } else {
            router.settlePosition(position, cost, payout, 0, fee, awards);
            used = begin - gasleft();
        }
        (bytes32[] memory reads, bytes32[] memory writes) = vm.accesses(address(vault));
        emit log_named_string(
            syntheticBoundary() ? "SYNTHETIC boundary / real Bank-Vault" : "production contiguous history", label()
        );
        emit log_named_string("terminal branch", cost == 0 ? "profit" : "maximum cost");
        emit log_named_uint("cold Router-Bank-Vault terminal gas (not full callback)", used);
        emit log_named_uint("Vault recorded read slots", reads.length);
        emit log_named_uint("Vault recorded write slots", writes.length);
        SSOTTypes.SSOT memory s = bank.getSSOT();
        assertTrue(s.accountingValid);
        uint256 protocolCapital = beforeRoot == 0 && STAKE > actualCost ? STAKE - actualCost : 0;
        assertEq(s.L, beforeRoot + STAKE - actualCost - protocolCapital);
        assertEq(s.vaultCash, s.L);
        assertEq(s.PF, beforeFees + protocolCapital + fee);
        assertEq(s.bankCash, s.PF + xp);
        assertEq(s.P + s.R + s.K + s.PP, 0);
        assertEq(s.XP, xp);
        assertEq(token.balanceOf(PLAYER), beforePlayer + payout);
        assertEq(bank.openHolds(), 0);
    }

    function _coolAccounting() private {
        vm.cool(address(token));
        vm.cool(address(router));
        vm.cool(address(bank));
        vm.cool(address(vault));
    }
}

contract NftTreeGasAligned16Test is NftReachableTreeGasBase {
    function config() internal pure override returns (uint256, uint256, History) {
        return (16, 8, History.Fresh);
    }

    function label() internal pure override returns (string memory) {
        return "16 old / 8 late / fresh";
    }
}

contract NftTreeGasRagged17Test is NftReachableTreeGasBase {
    function config() internal pure override returns (uint256, uint256, History) {
        return (17, 8, History.Fresh);
    }

    function label() internal pure override returns (string memory) {
        return "17 old / 8 late / fresh";
    }
}

contract NftTreeGasRagged255Test is NftReachableTreeGasBase {
    function config() internal pure override returns (uint256, uint256, History) {
        return (255, 256, History.Fresh);
    }

    function label() internal pure override returns (string memory) {
        return "255 old / 256 late / fresh";
    }
}

contract NftTreeGasAligned256Test is NftReachableTreeGasBase {
    function config() internal pure override returns (uint256, uint256, History) {
        return (256, 256, History.Fresh);
    }

    function label() internal pure override returns (string memory) {
        return "256 old / 256 late / fresh";
    }
}

contract NftTreeGasRagged1023Test is NftReachableTreeGasBase {
    function config() internal pure override returns (uint256, uint256, History) {
        return (1023, 1024, History.Fresh);
    }

    function label() internal pure override returns (string memory) {
        return "1023 old / 1024 late / fresh";
    }
}

contract NftTreeGasLazy255Test is NftReachableTreeGasBase {
    function config() internal pure override returns (uint256, uint256, History) {
        return (255, 256, History.Lazy32);
    }

    function label() internal pure override returns (string memory) {
        return "255 old / 256 late / 32 alternating prior terminals";
    }
}

contract NftTreeGasThin255Test is NftReachableTreeGasBase {
    function config() internal pure override returns (uint256, uint256, History) {
        return (255, 256, History.ThinPrefix);
    }

    function label() internal pure override returns (string memory) {
        return "255 old / 256 late / old prefix reduced to one unit";
    }
}

contract NftTreeGasThin1023Test is NftReachableTreeGasBase {
    function config() internal pure override returns (uint256, uint256, History) {
        return (1023, 1024, History.ThinPrefix);
    }

    function label() internal pure override returns (string memory) {
        return "1023 old / 1024 late / old prefix reduced to one unit";
    }
}

contract NftTreeGasSparse4095LazyTest is NftReachableTreeGasBase {
    function config() internal pure override returns (uint256, uint256, History) {
        return (4095, 1, History.SparseBoundaryLazy);
    }

    function label() internal pure override returns (string memory) {
        return "4096 real lifetime mints / two survivors / later whole-range profit";
    }
}

contract NftTreeGasSparse16383Test is NftReachableTreeGasBase {
    function config() internal pure override returns (uint256, uint256, History) {
        return (16383, 1, History.SparseBoundary);
    }

    function label() internal pure override returns (string memory) {
        return "16384 real lifetime mints / two survivors / first terminal";
    }
}

contract NftTreeGasSparse16383LazyTest is NftReachableTreeGasBase {
    function config() internal pure override returns (uint256, uint256, History) {
        return (16383, 1, History.SparseBoundaryLazy);
    }

    function label() internal pure override returns (string memory) {
        return "16384 real lifetime mints / two survivors / later whole-range profit";
    }
}

contract NftTreeGasEmptyPrefix255Test is NftReachableTreeGasBase {
    function config() internal pure override returns (uint256, uint256, History) {
        return (255, 256, History.EmptyPrefix);
    }

    function label() internal pure override returns (string memory) {
        return "255 old / 256 late / old prefix fully withdrawn";
    }
}

contract NftTreeGasEmptyRootTest is NftReachableTreeGasBase {
    function config() internal pure override returns (uint256, uint256, History) {
        return (1, 0, History.EmptyRoot);
    }

    function label() internal pure override returns (string memory) {
        return "one old / no late / K=0 / all NFTs withdrawn";
    }
}

/// @dev Compressed counter, actual Bank/Vault and production-engine awards to three fresh recipients.
///      Three awards cover player rakeback and L1/L2, including source locks and holdback. This is the
///      structural long-history witness from nft-tree-gas-reachability.md, not a current-state attack.
contract NftTreeGasSyntheticBankThreeAwardsTest is NftReachableTreeGasBase {
    function test_boundedThreeAwardAccountingSettlesProfitAndConservesFunds() public {
        _measure(0, true);
    }

    function test_boundedThreeAwardAccountingSettlesLossAndConservesFunds() public {
        _measure(terminalMaximum, true);
    }

    function config() internal pure override returns (uint256, uint256, History) {
        return (1, 1, History.SparseBoundaryLazy);
    }

    function label() internal pure override returns (string memory) {
        return "counter compressed to LAST-1 / two NFTs / later whole-range profit / actual engine: 3 awards, 3 payees";
    }

    function syntheticBoundary() internal pure override returns (bool) {
        return true;
    }

    function awardCount() internal pure override returns (uint256) {
        return 3;
    }
}

/// @notice Structural pressure fixture, NOT an executed production history.
/// @dev forceNextNode skips up to 2^40 NFT IDs. Only the pinned tree with its documented query patch is measured;
///      no claim is made that these exact lazy records arose through real Bank/Vault transactions.
abstract contract NftSyntheticTreeGasBase is Test {
    uint48 internal constant FIRST = uint48(1) << 40;
    uint48 internal constant LAST = FIRST * 2 - 1;
    uint128 internal constant DEPOSIT = 1_000e6;
    uint128 internal constant DELTA = 100e6;
    AzuroTreeHarness internal tree;
    uint48 internal cutoff;
    uint128 internal beforeRoot;

    enum Shape {
        FullSpine,
        OnlyBoundary,
        EmptyPrefix,
        ThinPrefix
    }
    function shape() internal pure virtual returns (Shape);
    function label() internal pure virtual returns (string memory);

    function setUp() public {
        tree = new AzuroTreeHarness();
        Shape selected = shape();
        if (selected == Shape.OnlyBoundary) {
            tree.forceNextNode(LAST - 1);
            tree.deposit(DEPOSIT);
        } else {
            for (uint48 remaining = 40; remaining != 0; --remaining) {
                tree.forceNextNode(FIRST + FIRST - (uint48(1) << remaining));
                tree.deposit(DEPOSIT);
            }
        }
        cutoff = LAST - 1;
        tree.deposit(DEPOSIT); // Last possible leaf, excluded by the ordinary prefix.
        if (selected == Shape.EmptyPrefix || selected == Shape.ThinPrefix) {
            tree.withdraw(FIRST, selected == Shape.EmptyPrefix ? 1e12 : 1e12 - 1);
            cutoff = FIRST;
        }
        // Updating the entire root leaves children stale, increasing the following _push writes.
        tree.profit(tree.reserve() / 3, LAST);
        beforeRoot = tree.reserve();
    }

    function test_coldSyntheticVendorProfit() public {
        _measure(false);
    }

    function test_coldSyntheticVendorLoss() public {
        _measure(true);
    }

    function _measure(bool loss) private {
        vm.cool(address(tree));
        vm.record();
        uint256 begin = gasleft();
        if (loss) tree.loss(DELTA, cutoff);
        else tree.profit(DELTA, cutoff);
        uint256 used = begin - gasleft();
        (bytes32[] memory reads, bytes32[] memory writes) = vm.accesses(address(tree));
        emit log_named_string("SYNTHETIC 40-level tree only", label());
        emit log_named_string("branch", loss ? "loss" : "profit");
        emit log_named_uint("cold vendor tree gas (no custody, no production reachability claim)", used);
        emit log_named_uint("tree recorded read slots", reads.length);
        emit log_named_uint("tree recorded write slots", writes.length);
        assertEq(tree.reserve(), loss ? beforeRoot - DELTA : beforeRoot + DELTA);
    }
}

contract NftTreeGasSyntheticFullSpineTest is NftSyntheticTreeGasBase {
    function shape() internal pure override returns (Shape) {
        return Shape.FullSpine;
    }

    function label() internal pure override returns (string memory) {
        return "40 nonzero sibling branches / root lazy / cutoff LAST-1";
    }
}

contract NftTreeGasSyntheticBoundaryTest is NftSyntheticTreeGasBase {
    function shape() internal pure override returns (Shape) {
        return Shape.OnlyBoundary;
    }

    function label() internal pure override returns (string memory) {
        return "only LAST-1 and LAST funded / root lazy";
    }
}

contract NftTreeGasSyntheticEmptyPrefixTest is NftSyntheticTreeGasBase {
    function shape() internal pure override returns (Shape) {
        return Shape.EmptyPrefix;
    }

    function label() internal pure override returns (string memory) {
        return "40-level spine / empty first leaf / whole-tree fallback";
    }
}

contract NftTreeGasSyntheticThinPrefixTest is NftSyntheticTreeGasBase {
    function shape() internal pure override returns (Shape) {
        return Shape.ThinPrefix;
    }

    function label() internal pure override returns (string memory) {
        return "40-level spine / one-unit first leaf / loss fallback";
    }
}
