export const GAME_HUB_KEEPER_ABI = [
  {
    type: "event",
    name: "BetPlaced",
    inputs: [
      { indexed: true, name: "positionId", type: "uint256" },
      { indexed: true, name: "gameId", type: "bytes32" },
      { indexed: true, name: "player", type: "address" },
      { indexed: false, name: "poolId", type: "uint64" },
      { indexed: false, name: "asset", type: "address" },
      { indexed: false, name: "bank", type: "address" },
      { indexed: false, name: "stake", type: "uint256" },
      { indexed: false, name: "reserved", type: "uint256" },
      { indexed: false, name: "amountPerRoll", type: "uint256" },
      { indexed: false, name: "betCount", type: "uint32" },
      { indexed: false, name: "stopGain", type: "uint256" },
      { indexed: false, name: "stopLoss", type: "uint256" },
      { indexed: false, name: "vrfFeePaid", type: "uint256" },
      { indexed: false, name: "vrfFeeCharged", type: "uint256" },
      { indexed: false, name: "vrfCallbackGasLimit", type: "uint32" },
      { indexed: false, name: "requestId", type: "uint256" },
      { indexed: false, name: "snapshotHash", type: "bytes32" },
      { indexed: false, name: "paramsHash", type: "bytes32" },
      { indexed: false, name: "pricingAffiliate", type: "address" },
      { indexed: false, name: "baseHouseEdgeBps", type: "uint16" },
      { indexed: false, name: "effectiveHouseEdgeBps", type: "uint16" },
      { indexed: false, name: "maxHouseEdgeBps", type: "uint16" },
      { indexed: false, name: "referralConfigId", type: "uint32" },
      { indexed: false, name: "deltaSkylineHash", type: "bytes32" }
    ]
  },
  {
    type: "event",
    name: "BetRandomReady",
    inputs: [
      { indexed: true, name: "betId", type: "uint256" },
      { indexed: true, name: "requestId", type: "uint256" },
      { indexed: false, name: "randomHash", type: "bytes32" }
    ]
  },
  {
    type: "event",
    name: "BetFinalized",
    inputs: [
      { indexed: true, name: "positionId", type: "uint256" },
      { indexed: false, name: "payoutGross", type: "uint256" },
      { indexed: false, name: "payoutNet", type: "uint256" },
      { indexed: false, name: "feeOnPayout", type: "uint256" },
      { indexed: false, name: "protocolFeeAccrual", type: "uint256" }
    ]
  },
  {
    type: "event",
    name: "BetRefunded",
    inputs: [
      { indexed: true, name: "positionId", type: "uint256" },
      { indexed: false, name: "refundAmount", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "finalize",
    stateMutability: "nonpayable",
    inputs: [{ name: "betId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "getBet",
    stateMutability: "view",
    inputs: [{ name: "betId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "betId", type: "uint256" },
          { name: "gameId", type: "bytes32" },
          { name: "player", type: "address" },
          { name: "asset", type: "address" },
          { name: "bank", type: "address" },
          { name: "stake", type: "uint256" },
          { name: "reserved", type: "uint256" },
          { name: "amountPerRoll", type: "uint256" },
          { name: "betCount", type: "uint32" },
          { name: "stopGain", type: "uint256" },
          { name: "stopLoss", type: "uint256" },
          { name: "pricingAffiliate", type: "address" },
          { name: "baseHouseEdgeBps", type: "uint16" },
          { name: "effectiveHouseEdgeBps", type: "uint16" },
          { name: "maxHouseEdgeBps", type: "uint16" },
          { name: "referralConfigId", type: "uint32" },
          { name: "deltaSkylineHash", type: "bytes32" },
          { name: "snapshotHash", type: "bytes32" },
          { name: "paramsHash", type: "bytes32" },
          { name: "vrfFeePaid", type: "uint256" },
          { name: "vrfFeeCharged", type: "uint256" },
          { name: "vrfCallbackGasLimit", type: "uint32" },
          { name: "requestId", type: "uint256" },
          { name: "randomHash", type: "bytes32" },
          { name: "placedAt", type: "uint64" },
          { name: "vrfRequestedAt", type: "uint64" },
          { name: "resolvedAt", type: "uint64" },
          { name: "state", type: "uint8" }
        ]
      }
    ]
  }
] as const;

export const VRF_HUB_KEEPER_ABI = [
  {
    type: "event",
    name: "Fulfilled",
    inputs: [
      { indexed: true, name: "requestId", type: "uint256" },
      { indexed: true, name: "hub", type: "address" },
      { indexed: true, name: "betId", type: "uint256" },
      { indexed: false, name: "randomHash", type: "bytes32" }
    ]
  }
] as const;

export const SPORTS_HUB_KEEPER_ABI = [
  {
    type: "event",
    name: "MarketVoided",
    inputs: [
      { indexed: true, name: "marketId", type: "uint64" },
      { indexed: true, name: "eventId", type: "uint64" },
      { indexed: false, name: "reasonHash", type: "bytes32" },
      { indexed: false, name: "operator", type: "address" }
    ]
  },
  {
    type: "event",
    name: "TicketPlaced",
    inputs: [
      { indexed: true, name: "ticketId", type: "uint256" },
      { indexed: true, name: "positionId", type: "uint256" },
      { indexed: true, name: "marketId", type: "uint64" },
      { indexed: false, name: "eventId", type: "uint64" },
      { indexed: false, name: "poolId", type: "uint64" },
      { indexed: false, name: "outcomeId", type: "uint32" },
      { indexed: false, name: "player", type: "address" },
      { indexed: false, name: "stake", type: "uint256" },
      { indexed: false, name: "payout", type: "uint256" },
      { indexed: false, name: "reserved", type: "uint256" },
      { indexed: false, name: "oddsSnapshotHash", type: "bytes32" },
      { indexed: false, name: "rulebookHash", type: "bytes32" }
    ]
  },
  {
    type: "event",
    name: "ResultProposed",
    inputs: [
      { indexed: true, name: "marketId", type: "uint64" },
      { indexed: true, name: "eventId", type: "uint64" },
      { indexed: false, name: "winningOutcomeId", type: "uint32" },
      { indexed: false, name: "resultPayloadHash", type: "bytes32" },
      { indexed: false, name: "resultSourceHash", type: "bytes32" },
      { indexed: false, name: "evidenceHash", type: "bytes32" },
      { indexed: false, name: "rulebookHash", type: "bytes32" },
      { indexed: false, name: "reporterSetHash", type: "bytes32" },
      { indexed: false, name: "reporterThreshold", type: "uint8" },
      { indexed: false, name: "reporterCount", type: "uint8" },
      { indexed: false, name: "proposer", type: "address" },
      { indexed: false, name: "observedAt", type: "uint64" },
      { indexed: false, name: "finalizesAt", type: "uint64" }
    ]
  },
  {
    type: "event",
    name: "ResultChallengeResolved",
    inputs: [
      { indexed: true, name: "marketId", type: "uint64" },
      { indexed: true, name: "resultPayloadHash", type: "bytes32" },
      { indexed: false, name: "decision", type: "uint8" },
      { indexed: false, name: "decisionHash", type: "bytes32" },
      { indexed: false, name: "arbitrator", type: "address" }
    ]
  },
  {
    type: "event",
    name: "ResultFinalized",
    inputs: [
      { indexed: true, name: "marketId", type: "uint64" },
      { indexed: true, name: "eventId", type: "uint64" },
      { indexed: false, name: "winningOutcomeId", type: "uint32" },
      { indexed: false, name: "resultPayloadHash", type: "bytes32" }
    ]
  },
  {
    type: "event",
    name: "TicketSettled",
    inputs: [
      { indexed: true, name: "ticketId", type: "uint256" },
      { indexed: true, name: "positionId", type: "uint256" },
      { indexed: false, name: "payout", type: "uint256" }
    ]
  },
  {
    type: "event",
    name: "TicketRefunded",
    inputs: [
      { indexed: true, name: "ticketId", type: "uint256" },
      { indexed: true, name: "positionId", type: "uint256" },
      { indexed: false, name: "refundAmount", type: "uint256" }
    ]
  },
  {
    type: "event",
    name: "TicketVoided",
    inputs: [
      { indexed: true, name: "ticketId", type: "uint256" },
      { indexed: true, name: "positionId", type: "uint256" },
      { indexed: false, name: "refundAmount", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "finalizeResult",
    stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "uint64" }],
    outputs: []
  },
  {
    type: "function",
    name: "settleTicket",
    stateMutability: "nonpayable",
    inputs: [{ name: "ticketId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "refundTicket",
    stateMutability: "nonpayable",
    inputs: [{ name: "ticketId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "getMarket",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint64" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "marketId", type: "uint64" },
          { name: "eventId", type: "uint64" },
          { name: "poolId", type: "uint64" },
          { name: "outcomeCount", type: "uint32" },
          { name: "startsAt", type: "uint64" },
          { name: "lockTime", type: "uint64" },
          { name: "resultFinalitySeconds", type: "uint64" },
          { name: "version", type: "uint64" },
          { name: "marketKey", type: "bytes32" },
          { name: "rulebookHash", type: "bytes32" },
          { name: "state", type: "uint8" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "getTicket",
    stateMutability: "view",
    inputs: [{ name: "ticketId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "ticketId", type: "uint256" },
          { name: "positionId", type: "uint256" },
          { name: "marketId", type: "uint64" },
          { name: "eventId", type: "uint64" },
          { name: "poolId", type: "uint64" },
          { name: "outcomeId", type: "uint32" },
          { name: "player", type: "address" },
          { name: "stake", type: "uint256" },
          { name: "payout", type: "uint256" },
          { name: "reserved", type: "uint256" },
          { name: "oddsSnapshotHash", type: "bytes32" },
          { name: "rulebookHash", type: "bytes32" },
          { name: "acceptedAt", type: "uint64" },
          { name: "state", type: "uint8" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "nextTicketId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "getResult",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint64" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "marketId", type: "uint64" },
          { name: "eventId", type: "uint64" },
          { name: "poolId", type: "uint64" },
          { name: "winningOutcomeId", type: "uint32" },
          { name: "marketVersion", type: "uint64" },
          { name: "resultPayloadHash", type: "bytes32" },
          { name: "resultSourceHash", type: "bytes32" },
          { name: "evidenceHash", type: "bytes32" },
          { name: "rulebookHash", type: "bytes32" },
          { name: "reporterSetHash", type: "bytes32" },
          { name: "reporterThreshold", type: "uint8" },
          { name: "reporterCount", type: "uint8" },
          { name: "proposer", type: "address" },
          { name: "observedAt", type: "uint64" },
          { name: "proposedAt", type: "uint64" },
          { name: "finalizesAt", type: "uint64" },
          { name: "challenged", type: "bool" },
          { name: "challengeReasonHash", type: "bytes32" },
          { name: "challenger", type: "address" },
          { name: "challengedAt", type: "uint64" },
          { name: "challengeDecision", type: "uint8" },
          { name: "arbitrationDecisionHash", type: "bytes32" },
          { name: "arbitrator", type: "address" },
          { name: "arbitratedAt", type: "uint64" }
        ]
      }
    ]
  }
] as const;
