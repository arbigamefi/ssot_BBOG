export const GAME_HUB_KEEPER_ABI = [
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
