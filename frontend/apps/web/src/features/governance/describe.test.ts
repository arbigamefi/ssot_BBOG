import { describe, expect, it } from "vitest";

import en from "../../i18n/locales/en/common.json";
import { describeGovernanceCall, formatBps, formatDuration } from "./describe";
import type { GovernanceCallView } from "./types";

function t(key: string, values: Record<string, string | number> = {}) {
  const message = key
    .split(".")
    .reduce<unknown>((value, part) => (value as Record<string, unknown> | undefined)?.[part], en);
  if (typeof message !== "string") throw new Error(`missing message ${key}`);
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    message
  );
}

const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const BANK = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";
const TARGET = "0x3333333333333333333333333333333333333333";
const GAME_ID = `0x${"ab".repeat(32)}`;
const release = {
  pools: [{ poolId: 1, asset: USDC.toLowerCase(), symbol: "USDC", decimals: 6 }],
  assets: [{ address: USDC.toLowerCase(), symbol: "USDC", decimals: 6 }],
  gamesMeta: [{ gameId: GAME_ID, label: "Dice" }]
};

function call(
  contract: GovernanceCallView["contract"],
  name: string,
  args: Array<[string, string, string | boolean]>,
  extra: Partial<GovernanceCallView> = {}
): GovernanceCallView {
  return {
    target: TARGET,
    contract,
    selector: "0x12345678",
    function: {
      name,
      signature: `${name}(${args.map(([, type]) => type).join(",")})`,
      args: args.map(([argName, type, value]) => ({ name: argName, type, value }))
    },
    ...extra
  };
}

const describeLine = (value: GovernanceCallView) => describeGovernanceCall(value, release, "en", t);
const registry = { name: "PoolRegistry" as const };
const hub = { name: "GameHub" as const };
const bank = { name: "Bank" as const, poolId: 1 };
const timelock = { name: "GovernanceTimelock" as const };

describe("governance call lines", () => {
  it.each([
    [
      call(registry, "registerPool", [
        ["poolId", "uint64", "2"],
        ["asset", "address", USDC],
        ["bank", "address", BANK],
        ["domain", "uint8", "1"]
      ]),
      "Register pool #2 for USDC with Bank 0x1111…1111"
    ],
    [
      call(registry, "setPoolActive", [
        ["poolId", "uint64", "1"],
        ["active", "bool", true]
      ]),
      "Start betting in pool #1 (USDC)"
    ],
    [
      call(registry, "setHubRegistered", [
        ["hub", "address", OTHER],
        ["registered", "bool", true]
      ]),
      "Register betting hub 0x2222…2222"
    ],
    [
      call(registry, "setHubAllowedForPool", [
        ["poolId", "uint64", "1"],
        ["hub", "address", OTHER],
        ["allowed", "bool", false]
      ]),
      "Stop hub 0x2222…2222 from taking bets in pool #1 (USDC)"
    ],
    [
      call(hub, "registerGame", [
        ["gameId", "bytes32", GAME_ID],
        ["module", "address", OTHER],
        ["maxBetCount", "uint32", "25"],
        ["callbackGasLimit", "uint32", "2447746"]
      ]),
      "Add game Dice (module 0x2222…2222, up to 25 rounds per bet)"
    ],
    [
      call(hub, "queueEdgeChange", [["bps", "uint16", "250"]]),
      "Change the house edge to 2.5%; it can take effect 7 days after this executes"
    ],
    [
      call(hub, "setRefundTimeout", [["seconds_", "uint256", "3600"]]),
      "Set the refund timeout to 1 hour"
    ],
    [
      call(hub, "createReferralConfig", [
        ["l0Bps", "uint16", "100"],
        ["l1Bps", "uint16", "1000"],
        ["l2Bps", "uint16", "500"],
        ["holdbackBps", "uint16", "2000"]
      ]),
      "Create a referral config: player rakeback 1%, level 1 10%, level 2 5%, holdback 20%"
    ],
    [call(hub, "setActiveReferralConfig", [["id", "uint32", "3"]]), "Switch to referral config #3"],
    [call(bank, "setRiskInPaused", [["paused_", "bool", false]]), "Unpause pool #1 (USDC)"],
    [call(bank, "setRiskInPaused", [["paused_", "bool", true]]), "Pause pool #1 (USDC)"],
    [
      call(bank, "setMinBetAmount", [["value", "uint256", "1500000"]]),
      "Set the minimum bet in pool #1 (USDC) to 1.5 USDC"
    ],
    [
      call(bank, "setRiskReserveBps", [["bps", "uint256", "1000"]]),
      "Set the risk reserve in pool #1 (USDC) to 10%"
    ],
    [
      call(bank, "setWithdrawalBufferBps", [["bps", "uint256", "500"]]),
      "Set the withdrawal buffer in pool #1 (USDC) to 5%"
    ],
    [
      call(bank, "setHoldbackVestingSeconds", [["seconds_", "uint256", "2592000"]]),
      "Set referral holdback vesting in pool #1 (USDC) to 30 days"
    ],
    [
      call(bank, "setMinPlayerTurnoverForUnlock", [["turnover_", "uint256", "100000000"]]),
      "Set the player turnover that unlocks locked referral rewards in pool #1 (USDC) to 100 USDC"
    ],
    [
      call(bank, "rescueToken", [
        ["token", "address", USDC],
        ["to", "address", OTHER],
        ["amount", "uint256", "2000000"]
      ]),
      "Send 2 USDC from the Bank of pool #1 (USDC) to 0x2222…2222"
    ],
    [
      call(bank, "rescueToken", [
        ["token", "address", TARGET],
        ["to", "address", OTHER],
        ["amount", "uint256", "7"]
      ]),
      "Send 7 base units of token 0x3333…3333 from the Bank of pool #1 (USDC) to 0x2222…2222"
    ],
    [
      call(bank, "claimProtocolFees", [
        ["amount", "uint256", "3000000"],
        ["receiver", "address", OTHER]
      ]),
      "Pay 3 USDC of protocol fees from pool #1 (USDC) to 0x2222…2222"
    ]
  ])("describes %#", (value, text) => {
    expect(describeLine(value)).toEqual({ text, critical: false, unknown: false });
  });

  it.each([
    [
      call(bank, "setGuardian", [["guardian_", "address", OTHER]]),
      "Make 0x2222…2222 the guardian of pool #1 (USDC)"
    ],
    [
      call(hub, "setSentinel", [["sentinel_", "address", OTHER]]),
      "Make 0x2222…2222 the sentinel of the game hub"
    ],
    [
      call(registry, "setSentinel", [
        ["sentinel_", "address", "0x0000000000000000000000000000000000000000"]
      ]),
      "Remove the sentinel of the pool registry"
    ],
    [
      call(bank, "transferGovernance", [["newGov", "address", OTHER]]),
      "Hand governance of the Bank of pool #1 (USDC) to 0x2222…2222"
    ],
    [
      call(timelock, "updateDelay", [["newDelay", "uint256", "259200"]]),
      "Change the governance delay to 72 hours"
    ],
    [
      call(
        timelock,
        "grantRole",
        [
          ["role", "bytes32", `0x${"aa".repeat(32)}`],
          ["account", "address", OTHER]
        ],
        { roleName: "PROPOSER_ROLE" }
      ),
      "Grant the proposer role to 0x2222…2222"
    ],
    [
      call(
        timelock,
        "revokeRole",
        [
          ["role", "bytes32", `0x${"bb".repeat(32)}`],
          ["account", "address", OTHER]
        ],
        { roleName: "CANCELLER_ROLE" }
      ),
      "Revoke the canceller role from 0x2222…2222"
    ]
  ])("marks control changes as critical: %#", (value, text) => {
    expect(describeLine(value)).toEqual({ text, critical: true, unknown: false });
  });

  it("names target and selector for a call it cannot decode, and flags it", () => {
    expect(
      describeLine({ target: TARGET, contract: { name: "unknown" }, selector: "0xdeadbeef" })
    ).toEqual({
      text: "Unrecognized call to 0x3333…3333 (function selector 0xdeadbeef)",
      critical: true,
      unknown: true
    });
    expect(describeLine({ target: TARGET, contract: { name: "unknown" } }).text).toBe(
      "Call to 0x3333…3333 with no function data"
    );
  });

  it("falls back to the signature for a known function without a template", () => {
    expect(describeLine(call(hub, "activateEdgeChange", []))).toEqual({
      text: "Call activateEdgeChange() on the game hub",
      critical: false,
      unknown: false
    });
  });

  it("formats percentages and durations in the reader's locale", () => {
    expect(formatBps("250", "en")).toBe("2.5%");
    expect(formatDuration("259200", "en")).toBe("72 hours");
    expect(formatDuration("604800", "en")).toBe("7 days");
    expect(formatDuration("90", "en")).toBe("90 seconds");
    expect(formatDuration("259200", "zh-Hans")).toContain("72");
  });
});
