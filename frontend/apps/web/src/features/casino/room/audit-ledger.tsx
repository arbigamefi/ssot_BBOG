import * as React from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { AuditTabs, AuditTableCell, AuditTableHeader, AuditTableRow, StatusBadge } from "@ssot/ui";

import { mapBetState, shortHex, type GameMeta } from "./model";

export type GameAuditBet = {
  id?: string;
  betId: string | number | bigint;
  player?: string;
  state?: string;
};

export function GameRoomAuditLedger({
  game,
  betAmount,
  recentBets
}: {
  game: GameMeta;
  betAmount: number;
  recentBets: readonly GameAuditBet[];
}) {
  return (
    <div className="pointer-events-auto flex flex-col overflow-hidden">
      <div className="border-b border-border-soft bg-surface-1 px-8 py-6">
        <AuditTabs activeColorClass="border-brand text-brand">
          <AuditTableHeader>
            <div className="grid w-full grid-cols-[1.2fr_1fr_1.5fr_1.2fr_80px] px-6 text-[10px] font-black uppercase tracking-[0.2em] text-fg-subtle">
              <div>Timestamp / Auth</div>
              <div>Submodule</div>
              <div>Wager Parameters</div>
              <div>Settlement State</div>
              <div className="text-right">Audit</div>
            </div>
          </AuditTableHeader>
          <div className="mt-4 flex flex-col gap-2 px-2">
            {recentBets.length > 0 ? (
              recentBets.map((bet, index) => (
                <AuditTableRow
                  key={bet.id ?? `${bet.betId.toString()}-${index}`}
                  className="group rounded-lg border border-border-soft bg-surface-0 px-6 py-5 transition-colors hover:bg-surface-2"
                >
                  <div className="grid w-full grid-cols-[1.2fr_1fr_1.5fr_1.2fr_80px] items-center">
                    <AuditTableCell>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-bold text-fg">
                          {new Date().toLocaleTimeString()}
                        </span>
                        <span className="font-mono text-[10px] text-fg-subtle">
                          {shortHex(bet.player)}
                        </span>
                      </div>
                    </AuditTableCell>
                    <AuditTableCell>
                      <span className="text-sm font-black text-fg">{game.label}</span>
                    </AuditTableCell>
                    <AuditTableCell>
                      <div className="flex flex-col">
                        <span className="mb-1 font-mono text-xs font-black text-brand">
                          {game.slug.toUpperCase()} SELECTION
                        </span>
                        <span className="font-mono text-[10px] tracking-tight text-fg-subtle">
                          {betAmount} USDC - ID: {bet.betId.toString().slice(-12)}
                        </span>
                      </div>
                    </AuditTableCell>
                    <AuditTableCell>
                      <StatusBadge status={mapBetState(bet.state)} />
                    </AuditTableCell>
                    <AuditTableCell className="justify-end">
                      <button
                        type="button"
                        aria-label={`Open audit for bet ${bet.betId.toString()}`}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-1 transition-transform hover:bg-surface-2 group-hover:scale-105"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4 text-fg-muted" />
                      </button>
                    </AuditTableCell>
                  </div>
                </AuditTableRow>
              ))
            ) : (
              <div className="rounded-xl border-2 border-dashed border-border-soft py-24 text-center">
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.5em] text-fg-subtle">
                  Immutable Audit Stream
                </div>
                <div className="font-mono text-xs font-bold text-fg-subtle">
                  STANDBY FOR ON-CHAIN TRANSACTION EMIT...
                </div>
              </div>
            )}
          </div>
        </AuditTabs>
      </div>
    </div>
  );
}
