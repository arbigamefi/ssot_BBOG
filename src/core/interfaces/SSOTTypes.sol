// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Protocol-wide SSOT types shared across Bank, vertical hubs, VRFHub, and modules.
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
        uint256 riskReserveBps; // [0..10_000], new-risk reserve buffer
        uint256 riskReserve; // NAV * riskReserveBps / 10_000
        uint256 riskFree; // NAV - R - riskReserve (clamped at 0)
        uint256 withdrawalBufferBps; // [0..10_000], optional-outflow buffer
        uint256 withdrawalBuffer; // NAV * withdrawalBufferBps / 10_000
        uint256 withdrawable; // NAV - R - withdrawalBuffer (clamped at 0)
        bool riskInPaused; // Risk-In + Optional outflow freeze

        // XP bucket breakdown (E-class invariants)
        uint256 xpAccruedTotal;
        uint256 xpLockedTotal;
        uint256 xpHoldbackTotal;

        // Referral unlock/release rules (permissionless)
        uint256 holdbackVestingSeconds;
        uint256 minPlayerTurnoverForUnlock;
    }

    /// @notice Casino hub-side bet lifecycle.
    enum BetState {
        None,
        Held,
        PendingVRF,
        RandomReady,
        Settled,
        Refunded
    }

    /// @notice Sportsbook market lifecycle owned by SportsHub.
    enum SportsMarketState {
        None,
        Draft,
        Open,
        Locked,
        Suspended,
        ResultProposed,
        Challenged,
        Resolved,
        Voided
    }

    /// @notice Sportsbook ticket lifecycle. Settlement funds still move only through SettlementRouter.
    enum SportsTicketState {
        None,
        Held,
        Settled,
        Refunded,
        Voided
    }

    /// @notice Authorized arbitration outcome for a challenged Sports result.
    enum SportsChallengeDecision {
        None,
        UpholdResult,
        ReopenResult,
        VoidMarket
    }

    /// @notice Casino hub-side canonical bet record (lifecycle SSOT).
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

    /// @notice Casino terminal settlement/refund receipt.
    /// @dev Bet stores lifecycle inputs; this stores final financial outputs so
    ///      frontends and keepers can read terminal results without scanning logs.
    struct BetTerminal {
        BetState state; // None until terminal; Settled or Refunded once written.
        uint256 payoutGross;
        uint256 payoutNet;
        uint256 feeOnPayout;
        uint256 protocolFeeAccrual;
        uint256 refundAmount;
    }

    /// @notice Sports market record. The rulebook hash defines market-specific void/push semantics.
    struct SportsMarket {
        uint64 marketId;
        uint64 eventId;
        uint64 poolId;
        uint32 outcomeCount;
        uint64 startsAt;
        uint64 lockTime;
        uint64 resultFinalitySeconds;
        uint64 version;
        bytes32 marketKey;
        bytes32 rulebookHash;
        SportsMarketState state;
    }

    /// @notice Signed or proven odds snapshot accepted by SportsHub for one fixed-odds ticket.
    struct SportsOddsSnapshot {
        uint64 marketId;
        uint32 outcomeId;
        uint64 marketVersion;
        uint256 oddsWad;
        uint256 maxStake;
        uint256 maxPayout;
        uint64 expiresAt;
        uint64 nonce;
        bytes32 riskHash;
    }

    /// @notice Sports ticket record bound to a router position.
    struct SportsTicket {
        uint256 ticketId;
        uint256 positionId;
        uint64 marketId;
        uint64 eventId;
        uint64 poolId;
        uint32 outcomeId;
        address player;
        uint256 stake;
        uint256 payout;
        uint256 reserved;
        bytes32 oddsSnapshotHash;
        bytes32 rulebookHash;
        uint64 acceptedAt;
        SportsTicketState state;
    }

    /// @notice Public result proposal/finality record for one sports market.
    struct SportsResult {
        uint64 marketId;
        uint64 eventId;
        uint64 poolId;
        uint32 winningOutcomeId;
        uint64 marketVersion;
        bytes32 resultPayloadHash;
        bytes32 resultSourceHash;
        bytes32 evidenceHash;
        bytes32 rulebookHash;
        bytes32 reporterSetHash;
        uint8 reporterThreshold;
        uint8 reporterCount;
        address proposer;
        uint64 observedAt;
        uint64 proposedAt;
        uint64 finalizesAt;
        bool challenged;
        bytes32 challengeReasonHash;
        address challenger;
        uint64 challengedAt;
        SportsChallengeDecision challengeDecision;
        bytes32 arbitrationDecisionHash;
        address arbitrator;
        uint64 arbitratedAt;
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
