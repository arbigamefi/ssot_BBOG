import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

import type { OpsGovernanceResponse } from "../governance/types";

const ops = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock("next-intl", async () => {
  const messages = (await import("../../i18n/locales/en/common.json")).default as Record<
    string,
    unknown
  >;
  const translate = (key: string, values?: Record<string, string | number>) => {
    const message = key
      .split(".")
      .reduce<unknown>(
        (value, part) => (value as Record<string, unknown> | undefined)?.[part],
        messages
      );
    if (typeof message !== "string") return key;
    return Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      message
    );
  };
  return {
    useLocale: () => "en",
    useTranslations:
      (namespace?: string) => (key: string, values?: Record<string, string | number>) =>
        translate(namespace ? `${namespace}.${key}` : key, values)
  };
});
vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));
vi.mock("../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    chainId: 84532,
    release: {
      pools: [
        {
          poolId: 1,
          asset: "0x0000000000000000000000000000000000000001",
          symbol: "USDC",
          decimals: 6
        }
      ],
      assets: [
        { address: "0x0000000000000000000000000000000000000001", symbol: "USDC", decimals: 6 }
      ],
      gamesMeta: [{ gameId: `0x${"ab".repeat(32)}`, label: "Dice" }]
    }
  })
}));
vi.mock("../governance/useGovernance", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../governance/useGovernance")>()),
  useOpsGovernance: () => ops.value
}));

import { OpsGovernancePanel } from "./ops-governance-panel";

const caller = "0x00000000000000000000000000000000000000ee";

function data(overrides: Partial<OpsGovernanceResponse> = {}): OpsGovernanceResponse {
  return {
    schemaVersion: 1,
    chainId: 84532,
    generatedAt: Date.now(),
    source: "postgres",
    timelock: "0x00000000000000000000000000000000000000aa",
    coverage: { indexedThroughBlock: 100, indexedThroughAt: Date.now() - 60_000, stale: false },
    operations: [
      {
        operationId: `0x${"01".repeat(32)}`,
        index: 0,
        state: "executed",
        readyAt: 1_800_000_000,
        scheduledAt: 1_799_740_800_000,
        scheduledTxHash: `0x${"0a".repeat(32)}`,
        executedTxHash: `0x${"0e".repeat(32)}`,
        value: "0",
        call: {
          target: "0x0000000000000000000000000000000000000066",
          contract: { name: "PoolRegistry" },
          selector: "0x12345678",
          function: {
            name: "setPoolActive",
            signature: "setPoolActive(uint64,bool)",
            args: [
              { name: "poolId", type: "uint64", value: "1" },
              { name: "active", type: "bool", value: true }
            ]
          }
        }
      },
      {
        operationId: `0x${"02".repeat(32)}`,
        index: 0,
        state: "cancelled",
        readyAt: 1_800_100_000,
        scheduledAt: 1_799_840_800_000,
        scheduledTxHash: `0x${"0b".repeat(32)}`,
        cancelledTxHash: `0x${"0c".repeat(32)}`,
        value: "0",
        call: {
          target: "0x00000000000000000000000000000000000000cc",
          contract: { name: "unknown" },
          selector: "0xdeadbeef"
        }
      }
    ],
    voidWindows: [
      {
        poolId: 1,
        bank: "0x0000000000000000000000000000000000000002",
        cohortEnd: 1_800_000_000,
        caller,
        blockNumber: 30,
        txHash: `0x${"0f".repeat(32)}`
      }
    ],
    disabledGames: [
      { gameId: `0x${"ab".repeat(32)}`, caller, blockNumber: 31, txHash: `0x${"1f".repeat(32)}` }
    ],
    ...overrides
  };
}

afterEach(() => cleanup());

describe("ops governance and risk panel", () => {
  it("shows executed and cancelled operations, void windows and disabled games", () => {
    ops.value = { isPending: false, isError: false, data: data() };
    render(<OpsGovernancePanel />);
    expect(screen.getByText("Executed")).toBeDefined();
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
    expect(screen.getByText("Start betting in pool #1 (USDC)")).toBeDefined();
    expect(
      screen.getByText("Unrecognized call to 0x0000…00cc (function selector 0xdeadbeef)")
    ).toBeDefined();
    const cohortEnd = new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(1_800_000_000_000));
    expect(
      screen.getByText(
        `Pool #1: bets requested by ${cohortEnd} can be voided 24 hours after their request. Opened by 0x0000...00ee.`
      )
    ).toBeDefined();
    expect(screen.getByText("Dice was disabled by 0x0000...00ee.")).toBeDefined();
  });

  it("names each empty list instead of hiding it", () => {
    ops.value = {
      isPending: false,
      isError: false,
      data: data({ operations: [], voidWindows: [], disabledGames: [] })
    };
    render(<OpsGovernancePanel />);
    expect(screen.getByText("No operation has been scheduled.")).toBeDefined();
    expect(screen.getByText("No void window has been opened.")).toBeDefined();
    expect(screen.getByText("No game has been disabled.")).toBeDefined();
  });

  it("reports an unreadable history as unavailable", () => {
    ops.value = { isPending: false, isError: false, data: data({ source: "unavailable" }) };
    render(<OpsGovernancePanel />);
    expect(
      screen.getByText(
        "Governance history could not be read: the bet index or the chain is unavailable."
      )
    ).toBeDefined();
    expect(screen.queryByText("No operation has been scheduled.")).toBeNull();
  });
});
