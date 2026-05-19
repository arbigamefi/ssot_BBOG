import * as React from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { AuditTabs, AuditTableCell, AuditTableHeader, AuditTableRow, StatusBadge } from "@ssot/ui";
import { useTranslations } from "next-intl";

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
  const t = useTranslations();
  const gameName = getLocalizedAuditGameName(t, game);

  return (
    <div className="pointer-events-auto flex flex-col overflow-hidden">
      <div className="border-b border-border-soft bg-surface-1 px-8 py-6">
        <AuditTabs activeColorClass="border-brand text-brand">
          <AuditTableHeader>
            <div className="grid w-full grid-cols-[1.2fr_1fr_1.5fr_1.2fr_80px] px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
              <div>{t("casino.room.audit.headers.timestampAuth")}</div>
              <div>{t("casino.room.audit.headers.submodule")}</div>
              <div>{t("casino.room.audit.headers.wagerParameters")}</div>
              <div>{t("casino.room.audit.headers.settlementState")}</div>
              <div className="text-right">{t("casino.room.audit.headers.audit")}</div>
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
                      <span className="text-sm font-semibold text-fg">{gameName}</span>
                    </AuditTableCell>
                    <AuditTableCell>
                      <div className="flex flex-col">
                        <span className="mb-1 font-mono text-xs font-semibold text-brand">
                          {t("casino.room.audit.selection", { game: game.slug.toUpperCase() })}
                        </span>
                        <span className="font-mono text-[10px] tracking-tight text-fg-subtle">
                          {t("casino.room.audit.amountAndId", {
                            amount: betAmount,
                            asset: "USDC",
                            id: bet.betId.toString().slice(-12)
                          })}
                        </span>
                      </div>
                    </AuditTableCell>
                    <AuditTableCell>
                      <StatusBadge status={mapBetState(bet.state)} />
                    </AuditTableCell>
                    <AuditTableCell className="justify-end">
                      <button
                        type="button"
                        aria-label={t("casino.room.audit.openAudit", {
                          betId: bet.betId.toString()
                        })}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-1 transition-colors hover:bg-surface-2"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4 text-fg-muted" />
                      </button>
                    </AuditTableCell>
                  </div>
                </AuditTableRow>
              ))
            ) : (
              <div className="rounded-xl border-2 border-dashed border-border-soft py-24 text-center">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.5em] text-fg-subtle">
                  {t("casino.room.audit.empty.title")}
                </div>
                <div className="font-mono text-xs font-bold text-fg-subtle">
                  {t("casino.room.audit.empty.description")}
                </div>
              </div>
            )}
          </div>
        </AuditTabs>
      </div>
    </div>
  );
}

function getLocalizedAuditGameName(t: (key: string) => string, game: GameMeta) {
  switch (game.slug) {
    case "dice":
      return t("casino.room.names.dice");
    case "roulette":
      return t("casino.room.names.roulette");
    case "coin-toss":
      return t("casino.room.names.coinToss");
    case "keno":
      return t("casino.room.names.keno");
    default:
      return game.label;
  }
}
