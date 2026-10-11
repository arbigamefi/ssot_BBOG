import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

import type { GovernanceOperationView, GovernanceQueueResponse } from "./types";

const queue = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

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
      gamesMeta: []
    }
  })
}));
vi.mock("./useGovernance", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./useGovernance")>()),
  useGovernanceQueue: () => queue.value
}));

import { GovernanceQueuePanel } from "./governance-queue-panel";

const nowSeconds = Math.floor(Date.now() / 1000);

function op(overrides: Partial<GovernanceOperationView>): GovernanceOperationView {
  return {
    operationId: `0x${"01".repeat(32)}`,
    index: 0,
    state: "waiting",
    readyAt: nowSeconds + 86_400,
    scheduledAt: Date.now() - 1000,
    scheduledTxHash: `0x${"0a".repeat(32)}`,
    value: "0",
    call: {
      target: "0x0000000000000000000000000000000000000002",
      contract: { name: "Bank", poolId: 1 },
      selector: "0x12345678",
      function: {
        name: "setRiskInPaused",
        signature: "setRiskInPaused(bool)",
        args: [{ name: "paused_", type: "bool", value: false }]
      }
    },
    ...overrides
  };
}

function response(overrides: Partial<GovernanceQueueResponse> = {}): GovernanceQueueResponse {
  return {
    schemaVersion: 1,
    chainId: 84532,
    generatedAt: Date.now(),
    source: "postgres",
    timelock: "0x00000000000000000000000000000000000000aa",
    coverage: { indexedThroughBlock: 100, indexedThroughAt: Date.now() - 60_000, stale: false },
    operations: [],
    ...overrides
  };
}

const EXPLAINER =
  "Changes wait 72 hours before anyone can execute them. If you disagree with one, you can withdraw a mature deposit before it executes.";

afterEach(() => cleanup());

describe("scheduled governance changes for LPs", () => {
  it("states plainly that nothing is scheduled, with the exit explanation", () => {
    queue.value = { isPending: false, isError: false, data: response() };
    render(<GovernanceQueuePanel />);
    expect(screen.getByRole("heading", { name: "Scheduled governance changes" })).toBeDefined();
    expect(screen.getByText(EXPLAINER)).toBeDefined();
    expect(screen.getByText("No governance change is scheduled.")).toBeDefined();
  });

  it("lists each waiting or ready change with when it can execute", () => {
    queue.value = {
      isPending: false,
      isError: false,
      data: response({
        operations: [
          op({}),
          op({
            operationId: `0x${"02".repeat(32)}`,
            readyAt: nowSeconds - 60,
            state: "ready",
            call: {
              target: "0x00000000000000000000000000000000000000aa",
              contract: { name: "GovernanceTimelock" },
              selector: "0x2f2ff15d",
              roleName: "PROPOSER_ROLE",
              function: {
                name: "grantRole",
                signature: "grantRole(bytes32,address)",
                args: [
                  { name: "role", type: "bytes32", value: `0x${"bb".repeat(32)}` },
                  {
                    name: "account",
                    type: "address",
                    value: "0x00000000000000000000000000000000000000cc"
                  }
                ]
              }
            }
          })
        ]
      })
    };
    render(<GovernanceQueuePanel />);
    expect(screen.getByText("Unpause pool #1 (USDC)")).toBeDefined();
    const when = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date((nowSeconds + 86_400) * 1000)
    );
    expect(screen.getByText(`Executable from ${when}`)).toBeDefined();
    expect(screen.getByText("Ready to execute")).toBeDefined();
    expect(screen.getByText("Grant the proposer role to 0x0000…00cc")).toBeDefined();
    // Only the role grant is critical.
    expect(screen.getAllByText("Critical")).toHaveLength(1);
    expect(screen.queryByText("No governance change is scheduled.")).toBeNull();
  });

  it("never claims an empty queue when it could not be read", () => {
    queue.value = { isPending: false, isError: false, data: response({ source: "unavailable" }) };
    render(<GovernanceQueuePanel />);
    expect(
      screen.getByText(
        "Scheduled governance changes could not be loaded. Check again before relying on this list."
      )
    ).toBeDefined();
    expect(screen.queryByText("No governance change is scheduled.")).toBeNull();
    cleanup();
    queue.value = { isPending: false, isError: true, data: undefined };
    render(<GovernanceQueuePanel />);
    expect(screen.queryByText("No governance change is scheduled.")).toBeNull();
  });

  it("warns that a stale index may miss a schedule instead of saying nothing is scheduled", () => {
    queue.value = {
      isPending: false,
      isError: false,
      data: response({
        coverage: {
          indexedThroughBlock: 100,
          indexedThroughAt: Date.now() - 7_200_000,
          stale: true
        }
      })
    };
    render(<GovernanceQueuePanel />);
    expect(screen.getByText(/This list may be incomplete/)).toBeDefined();
    expect(screen.queryByText("No governance change is scheduled.")).toBeNull();
  });
});
