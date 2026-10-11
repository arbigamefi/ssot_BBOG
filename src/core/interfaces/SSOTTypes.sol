// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @notice Protocol-wide SSOT types shared across Bank, vertical hubs, VRFHub, and modules.
///         Keep dependency-light: no imports, only types/enums/structs.
library SSOTTypes {
    /// @notice Pool risk/accounting domain.
    enum PoolDomain {
        Unknown,
        Casino
    }

    /// @notice Router-side position lifecycle.
    enum PositionState {
        None,
        Held,
        Settled,
        Refunded,
        Voided
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
        uint16 edgeBps; // house edge recorded at open; caps protocol fees + XP at settlement (SSOT v1.6)
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

    /// @notice Explicit two-custodian balances and liabilities; no share-price or legacy NAV aliases.
    struct SSOT {
        uint256 bankCash;
        uint256 vaultCash;
        uint256 L; // NFT tree capital
        uint256 P; // pending original player principal
        uint256 R; // gross maximum costs of all open holds
        uint256 K; // Vault locked capital, R-P
        uint256 G; // betting basis, L+P
        uint256 PF;
        uint256 XP;
        uint256 PP;
        uint256 bankSurplus; // unallocated; never increases L or G
        uint256 vaultSurplus;
        bool accountingValid; // false marks a deficit/mismatch, never a healthy zero-NAV sentinel
        uint256 riskReserveBps;
        uint256 riskReserve; // floor(G*riskReserveBps/10000)
        uint256 riskFree; // max(0, G-R-riskReserve)
        uint256 withdrawalBufferBps; // only PF/XP optional outflows
        uint256 withdrawalBuffer; // floor(G*withdrawalBufferBps/10000)
        uint256 lpFreeCapital; // L-K; independent of optional-outflow percentage buffer
        bool riskInPaused;
        uint256 xpAccruedTotal;
        uint256 xpLockedTotal;
        uint256 xpHoldbackTotal;
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
        Refunded,
        Voided
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
        uint16 houseEdgeBps;
        uint16 maxHouseEdgeBps; // normalized; 0 implies defaultHouseEdgeBps at acceptance

        // referral snapshot
        uint32 referralConfigId;

        bytes32 snapshotHash;
        bytes32 paramsHash;

        // VRF fee accounting (native token)
        uint256 vrfFeePaid;
        uint256 vrfFeeCharged;
        uint32 vrfCallbackGasLimit;

        uint256 requestId;
        bytes32 randomHash;

        uint64 placedAt;
        uint64 refundDeadline;
        uint64 vrfRequestedAt;
        uint64 resolvedAt;

        BetState state;
    }

    /// @notice Casino terminal settlement, refund or void receipt.
    /// @dev Bet stores lifecycle inputs; this stores final financial outputs so
    ///      frontends and keepers can read terminal results without scanning logs.
    struct BetTerminal {
        BetState state; // None until terminal; Settled, Refunded or Voided once written.
        uint256 payoutGross;
        uint256 payoutNet;
        uint256 feeOnPayout;
        uint256 protocolFeeAccrual;
        uint256 refundAmount;
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
