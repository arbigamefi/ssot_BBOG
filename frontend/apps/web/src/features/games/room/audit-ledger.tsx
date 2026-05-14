import * as React from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import {
  AuditTabs,
  AuditTableCell,
  AuditTableHeader,
  AuditTableRow,
  StatusBadge,
  cn
} from "@ssot/ui";

import { mapBetState, shortHex, type GameMeta } from "./model";

export type GameAuditBet = {
  id?: string;
  betId: string | number | bigint;
  player?: string;
  state?: string;
};

export function GameRoomAuditLedger({
  game,
  themeColor,
  betAmount,
  recentBets
}: {
  game: GameMeta;
  themeColor: string;
  betAmount: number;
  recentBets: readonly GameAuditBet[];
}) {
  return (
    <div className="flex flex-col pointer-events-auto overflow-hidden">
      <div className="px-8 py-6 border-b border-white/5 bg-white/[0.01]">
        <AuditTabs
          activeColorClass={cn(
            themeColor === "emerald"
              ? "border-emerald-400 text-emerald-400"
              : "border-purple-400 text-purple-400"
          )}
        >
          <AuditTableHeader>
            <div className="grid grid-cols-[1.2fr_1fr_1.5fr_1.2fr_80px] text-white/20 font-black uppercase tracking-[0.2em] text-[10px] px-6 w-full">
              <div>Timestamp / Auth</div>
              <div>Submodule</div>
              <div>Wager Parameters</div>
              <div>Settlement State</div>
              <div className="text-right">Audit</div>
            </div>
          </AuditTableHeader>
          <div className="flex flex-col gap-2 mt-4 px-2">
            {recentBets.length > 0 ? (
              recentBets.map((bet, index) => (
                <AuditTableRow
                  key={bet.id ?? `${bet.betId.toString()}-${index}`}
                  className="hover:bg-white/[0.03] transition-all border border-white/5 py-5 px-6 rounded-2xl bg-black/20 group"
                >
                  <div className="grid grid-cols-[1.2fr_1fr_1.5fr_1.2fr_80px] items-center w-full">
                    <AuditTableCell>
                      <div className="flex flex-col">
                        <span className="text-white font-mono text-xs font-bold">
                          {new Date().toLocaleTimeString()}
                        </span>
                        <span className="text-[10px] font-mono text-white/30">
                          {shortHex(bet.player)}
                        </span>
                      </div>
                    </AuditTableCell>
                    <AuditTableCell>
                      <span className="font-black text-white/90 text-sm">{game.label}</span>
                    </AuditTableCell>
                    <AuditTableCell>
                      <div className="flex flex-col">
                        <span
                          className={cn(
                            "font-black font-mono text-xs mb-1",
                            themeColor === "emerald" ? "text-emerald-500" : "text-purple-500"
                          )}
                        >
                          {game.slug.toUpperCase()} SELECTION
                        </span>
                        <span className="text-[10px] text-white/40 font-mono tracking-tight">
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
                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all group-hover:scale-110 border border-white/5"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4 text-white/60" />
                      </button>
                    </AuditTableCell>
                  </div>
                </AuditTableRow>
              ))
            ) : (
              <div className="py-24 text-center border-2 border-white/5 rounded-3xl border-dashed">
                <div className="text-white/5 text-[10px] font-black uppercase tracking-[0.5em] mb-2">
                  Immutable Audit Stream
                </div>
                <div className="text-white/20 text-xs font-bold font-mono">
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
