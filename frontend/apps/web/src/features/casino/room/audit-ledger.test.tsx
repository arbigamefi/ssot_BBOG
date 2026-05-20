import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GameRoomAuditLedger } from "./audit-ledger";
import type { GameMeta } from "./model";

vi.mock("@ssot/ui", () => ({
  AuditTabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AuditTableHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AuditTableRow: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  AuditTableCell: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

vi.mock("@heroicons/react/24/outline", () => ({
  ArrowTopRightOnSquareIcon: ({ className }: { className?: string }) => (
    <svg aria-hidden="true" className={className} />
  )
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    ({
      "casino.room.names.roulette": "European Roulette",
      "casino.room.audit.headers.timestampAuth": "Timestamp / Auth",
      "casino.room.audit.headers.submodule": "Submodule",
      "casino.room.audit.headers.wagerParameters": "Wager Parameters",
      "casino.room.audit.headers.settlementState": "Settlement State",
      "casino.room.audit.headers.audit": "Audit",
      "casino.room.audit.selection": `${values?.game} Selection`,
      "casino.room.audit.amountAndId": `${values?.amount} ${values?.asset} - ID: ${values?.id}`,
      "casino.room.audit.openAudit": `Open audit for bet ${values?.betId}`,
      "casino.room.audit.empty.title": "Immutable Audit Stream",
      "casino.room.audit.empty.description": "Standby for on-chain transaction emit..."
    })[key] ?? key
}));

const game: GameMeta = {
  gameId: "0x1111111111111111111111111111111111111111",
  slug: "roulette",
  label: "European Roulette",
  module: "0x2222222222222222222222222222222222222222"
};

describe("GameRoomAuditLedger", () => {
  afterEach(() => cleanup());

  it("renders the standby state without recent bets", () => {
    render(<GameRoomAuditLedger game={game} betAmount={10} recentBets={[]} />);

    expect(screen.getByText("Immutable Audit Stream")).toBeDefined();
    expect(screen.getByText("Standby for on-chain transaction emit...")).toBeDefined();
  });

  it("renders indexed bet rows with mapped settlement state", () => {
    render(
      <GameRoomAuditLedger
        game={game}
        betAmount={25}
        recentBets={[
          {
            id: "84532:123456789",
            betId: "123456789",
            player: "0x1234567890abcdef1234567890abcdef12345678",
            state: "finalized"
          }
        ]}
      />
    );

    expect(screen.getByText("European Roulette")).toBeDefined();
    expect(screen.getByText("ROULETTE Selection")).toBeDefined();
    expect(screen.getByText("25 USDC - ID: 123456789")).toBeDefined();
    expect(screen.getByText("settled")).toBeDefined();
    expect(screen.getByLabelText("Open audit for bet 123456789")).toBeDefined();
  });
});
