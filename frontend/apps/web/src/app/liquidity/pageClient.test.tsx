import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

const state = {
  release: {
    assets: [{ address: "0x01", bank: "0x02", symbol: "USDC", decimals: 6 }]
  } as any,
  readOnly: false,
  readOnlyReason: null as string | null,
  chainId: 84532,
  sdk: null as any,
  ready: false
};

vi.mock("../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    release: state.release,
    readOnly: state.readOnly,
    readOnlyReason: state.readOnlyReason,
    chainId: state.chainId
  })
}));

vi.mock("../../ssot/sdk", () => ({
  useSSOTSDK: () => ({
    sdk: state.sdk,
    ready: state.ready
  })
}));

vi.mock("../../components/PageTransition", () => ({
  PageTransition: ({ children }: any) => <div>{children}</div>
}));

vi.mock("../../components/Placeholder", () => ({
  Placeholder: ({ title, description }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}));

vi.mock("../../components/ConnectWalletPrompt", () => ({
  ConnectWalletPrompt: ({ action }: any) => <div>Connect wallet to {action}</div>
}));

vi.mock("../../features/tx/useDirectTxAction", () => ({
  useDirectTxAction: () => ({
    status: "idle",
    steps: [],
    hasActivity: false,
    error: undefined,
    txHash: undefined,
    journalEntry: undefined,
    busy: false,
    reset: vi.fn(),
    execute: vi.fn()
  }),
  useSequencedTxAction: () => ({
    status: "idle",
    steps: [],
    hasActivity: false,
    error: undefined,
    txHash: undefined,
    journalEntry: undefined,
    busy: false,
    reset: vi.fn(),
    execute: vi.fn()
  })
}));

vi.mock("@ssot/ui", () => ({
  AssetSelector: () => <div>Asset selector</div>,
  Button: ({ children, asChild }: any) =>
    asChild ? children : <button type="button">{children}</button>,
  Card: ({ children }: any) => <section>{children}</section>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CopyButton: () => <button type="button">Copy</button>,
  ErrorCallout: ({ title, message }: any) => (
    <div>
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  ),
  GlassCard: ({ children }: any) => <section>{children}</section>,
  Input: (props: any) => <input {...props} />,
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
  PageHeader: ({ title, description, actions }: any) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </header>
  ),
  StatCard: ({ label, value, subValue }: any) => (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      {subValue ? <small>{subValue}</small> : null}
    </div>
  ),
  TabBar: ({ tabs }: any) => (
    <div>{tabs.map((tab: any) => <span key={tab.key}>{tab.label}</span>)}</div>
  ),
  TxStatusChip: ({ status }: any) => <span>{status}</span>,
  TxStepper: ({ title, subtitle }: any) => (
    <div>
      <span>{title}</span>
      <span>{subtitle}</span>
    </div>
  ),
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

import { LiquidityPageClient } from "./pageClient";

describe("LiquidityPageClient", () => {
  afterEach(() => {
    cleanup();
    state.release = {
      assets: [{ address: "0x01", bank: "0x02", symbol: "USDC", decimals: 6 }]
    };
    state.readOnly = false;
    state.readOnlyReason = null;
    state.chainId = 84532;
    state.sdk = null;
    state.ready = false;
  });

  it("frames liquidity as an LP readout instead of a generic vault form", () => {
    render(<LiquidityPageClient />);

    expect(screen.getByText("House Liquidity")).toBeDefined();
    expect(screen.getByText(/Provide USDC to the community bankroll/)).toBeDefined();
    expect(screen.getByText("Real-time NAV backing")).toBeDefined();
    expect(screen.getByText("Free headroom for redemptions")).toBeDefined();
    expect(screen.getByText("Protocol Performance")).toBeDefined();
    expect(screen.getByText("Connect wallet to deposit liquidity")).toBeDefined();
  });
});
