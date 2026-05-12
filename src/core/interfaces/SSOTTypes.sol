// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Protocol-wide SSOT types shared across Bank/Hub/VRFHub/Modules.
///         Keep dependency-light: no imports, only types/enums/structs.
library SSOTTypes {
    /// @notice Pool risk/accounting domain.
    enum PoolDomain {
        Unknown,
        Casino,
        Sports,
        Future
    }

    /// @notice Router-side position lifecycle.
    enum PositionState {
        None,
        Held,
        Settled,
        Refunded
    }

    /// @notice Pool registry record. A pool is one risk/accounting domain.
    struct Pool {
        address asset;
        address bank;
        PoolDomain domain;
        bool active;
    }

    /// @notice Router-side settlement record shared by vertical hubs.
    struct Position {
        uint256 positionId;
        address ownerHub;
        uint64 poolId;
        address asset;
        address bank;
        address player;
        uint256 stake;
        uint256 reserved;
        bytes32 snapshotHash;
        PositionState state;
    }

    /// @notice Stake specification for a bet (multi-roll).
    /// @dev amountPerRoll * betCount == stake (total escrow).
    struct StakeSpec {
        uint256 amountPerRoll;
        uint32 betCount;
        uint256 stopGain;
        uint256 stopLoss;
    }

    /// @notice Bank-side SSOT snapshot (accounting truth).
    struct SSOT {
        uint256 B; // ASSET.balanceOf(Bank)
        uint256 PF; // protocolFeesPayable
        uint256 XP; // externalPayablesTotal (== xpAccruedTotal + xpLockedTotal + xpHoldbackTotal)
        uint256 NAV; // B - PF - XP (no-underflow; underflow => violation)
        uint256 R; // totalReserved
        uint256 minLiquidityBps; // [0..10_000]
        uint256 minLiq; // NAV * bps / 10_000
        uint256 free; // NAV - R - minLiq (clamped at 0)
        bool riskInPaused; // Risk-In + Optional outflow freeze

        // XP bucket breakdown (E-class invariants)
        uint256 xpAccruedTotal;
        uint256 xpLockedTotal;
        uint256 xpHoldbackTotal;

        // Referral unlock/release rules (permissionless)
        uint256 holdbackVestingSeconds;
        uint256 minPlayerTurnoverForUnlock;
    }

    /// @notice Hub-side bet lifecycle (single SSOT registry).
    enum BetState {
        None,
        Held,
        PendingVRF,
        RandomReady,
        Settled,
        Refunded
    }

    /// @notice Hub-side canonical bet record (lifecycle SSOT).
    struct Bet {
        uint256 betId;
        bytes32 gameId;

        address player;
        address asset;
        address bank;
        uint256 stake; // total escrow = amountPerRoll * betCount
        uint256 reserved; // upper bound on payoutGross + refund

        // stake spec (multi-roll)
        uint256 amountPerRoll;
        uint32 betCount;
        uint256 stopGain;
        uint256 stopLoss;

        // pricing snapshot
        address pricingAffiliate;
        uint16 baseHouseEdgeBps;
        uint16 effectiveHouseEdgeBps;
        uint16 maxHouseEdgeBps; // normalized; 0 implies defaultHouseEdgeBps at acceptance

        // referral snapshot
        uint32 referralConfigId;
        bytes32 deltaSkylineHash;

        bytes32 snapshotHash;
        bytes32 paramsHash;

        // VRF fee accounting (native token)
        uint256 vrfFeePaid;
        uint256 vrfFeeCharged;
        uint32 vrfCallbackGasLimit;

        uint256 requestId;
        bytes32 randomHash;

        uint64 placedAt;
        uint64 vrfRequestedAt;
        uint64 resolvedAt;

        BetState state;
    }

    /// @notice XP award instruction produced during settlement (debt accrual, not a transfer).
    ///         - accrued: immediately claimable (still optional outflow)
    ///         - locked: gated by player turnover, attributed to sourcePlayer
    ///         - holdback: linearly vests via a non-extending aggregate schedule, permissionless sync
    struct XPAward {
        address payee;
        address sourcePlayer; // for locked attribution (player whose turnover gates unlock)
        uint256 accrued;
        uint256 locked;
        uint256 holdback;
        bytes32 reason; // for audit; e.g. keccak256("REFERRAL")
    }
}
