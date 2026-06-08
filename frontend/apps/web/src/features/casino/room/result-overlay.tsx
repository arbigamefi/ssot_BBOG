import * as React from "react";
import { useTranslations } from "next-intl";
import {
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardDocumentCheckIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import { getExplorerTxUrl } from "../../../app-shell/chain-registry";
import { Modal } from "../../../components/overlay";
import { buildCasinoReceiptFromTerminalResult } from "../receipt/view-model";
import { SharePanel } from "../../share/SharePanel";
import { buildShareUrl } from "../../share/share-link";
import { formatNativeFee } from "./casino-round";
import type { CasinoOutcome } from "./outcome";
import type { BaccaratSide, CoinSide, DiceDirection, SicBoKind } from "./params";
import type { CasinoRoundResult, CasinoTerminalRoundResult } from "./resolution";

function shortHash(value: string | undefined) {
  if (!value) return "—";
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function formatAddress(value: string | undefined) {
  if (!value) return "—";
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function formatResolvedAt(value: number | undefined) {
  if (!value) return "—";
  return new Date(value * 1000).toLocaleString();
}

function gameNameKeyFromSlug(slug: string) {
  if (slug === "coin-toss") return "coinToss";
  if (slug === "sic-bo") return "sicBo";
  return slug;
}

function useReceiptMaterialization({
  betId,
  chainId,
  terminalTxHash
}: {
  betId: bigint;
  chainId?: number;
  terminalTxHash?: string;
}) {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setReady(false);
    if (!chainId || !terminalTxHash) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const hydrate = async () => {
      attempts += 1;
      try {
        const response = await fetch(`/api/bets/receipt/${chainId}/${betId.toString()}/hydrate`, {
          body: JSON.stringify({ terminalTxHash }),
          headers: { "content-type": "application/json" },
          method: "POST"
        });
        if (cancelled) return;
        if (!response.ok) {
          if (attempts < 5) retryTimer = setTimeout(() => void hydrate(), 1500);
          return;
        }
        const payload = (await response.json()) as { row?: unknown; source?: string };
        if (payload.row && payload.source === "postgres") {
          setReady(true);
        } else if (attempts < 5) {
          retryTimer = setTimeout(() => void hydrate(), 1500);
        }
      } catch {
        if (!cancelled && attempts < 5) retryTimer = setTimeout(() => void hydrate(), 1500);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [betId, chainId, terminalTxHash]);

  return ready;
}

/**
 * Bundle every chain-verifiable fact about a settled round into a single,
 * self-describing JSON artifact the player can keep — the practical payoff of
 * "verifiable on-chain". Anyone can re-derive the outcome from these fields.
 */
function buildFairnessProof(args: {
  result: CasinoRoundResult;
  chainId: number | undefined;
  txHash: string | undefined;
}): string {
  const { result, chainId, txHash } = args;
  return JSON.stringify(
    {
      kind: "arbigamefi.proof-of-fairness.v1",
      chainId: chainId ?? null,
      betId: result.betId.toString(),
      requestId: result.requestId.toString(),
      randomHash: result.randomHash,
      settlementTx: txHash ?? null,
      explorerTx: getExplorerTxUrl(chainId, txHash) ?? null,
      resolvedAt: result.resolvedAt ?? null,
      exportedAt: new Date().toISOString()
    },
    null,
    2
  );
}

function CopyProofButton({
  proof,
  label,
  copiedLabel
}: {
  proof: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(proof);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard denied — no-op
        }
      }}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border-soft bg-surface-2 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-fg-muted transition-colors hover:border-brand/40 hover:text-fg"
    >
      {copied ? (
        <>
          <CheckIcon className="h-4 w-4 text-success" />
          {copiedLabel}
        </>
      ) : (
        <>
          <ClipboardDocumentCheckIcon className="h-4 w-4" />
          {label}
        </>
      )}
    </button>
  );
}

type Translate = ReturnType<typeof useTranslations>;

function getOutcome(result: CasinoTerminalRoundResult, t: Translate) {
  if (result.kind === "refunded") {
    return {
      label: t("casino.room.result.outcomes.refunded.label"),
      tone: "neutral" as const,
      detail: t("casino.room.result.outcomes.refunded.detail")
    };
  }

  const net = result.settlement.payoutNet - result.stake;
  if (net > 0n) {
    return {
      label: t("casino.room.result.outcomes.win.label"),
      tone: "win" as const,
      detail: t("casino.room.result.outcomes.win.detail")
    };
  }
  if (net === 0n) {
    return {
      label: t("casino.room.result.outcomes.returned.label"),
      tone: "neutral" as const,
      detail: t("casino.room.result.outcomes.returned.detail")
    };
  }
  return {
    label: t("casino.room.result.outcomes.loss.label"),
    tone: "loss" as const,
    detail: t("casino.room.result.outcomes.loss.detail")
  };
}

type GameResultContext = {
  gameSlug: string;
  resultNum: number | null;
  diceDirection: DiceDirection;
  diceTarget: number;
  coinSide: CoinSide;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  kenoResultDrawn: readonly number[];
  casinoOutcome?: CasinoOutcome | null;
};

type DetailTone = "win" | "loss" | "accent" | "neutral";

type GameResultRow = {
  label: string;
  value: string;
  tone?: DetailTone;
};

function formatList(values: readonly (number | string)[]) {
  return values.length > 0 ? values.join(", ") : "—";
}

function formatCoinSide(side: CoinSide, t: Translate) {
  return side === "HEADS"
    ? t("casino.room.selection.coin.heads")
    : t("casino.room.selection.coin.tails");
}

function formatPlinkoRisk(risk: string, t: Translate) {
  if (risk === "low" || risk === "medium" || risk === "high") {
    return t(`casino.room.selection.plinko.${risk}`);
  }
  return risk;
}

function formatBaccaratSide(side: BaccaratSide, t: Translate) {
  return t(`casino.room.selection.baccarat.${side}`);
}

function formatSicBoBet(kind: SicBoKind, value: number, t: Translate) {
  const label = t(`casino.room.selection.sicBo.kinds.${kind}`);
  if (
    kind === "total" ||
    kind === "specificTriple" ||
    kind === "specificDouble" ||
    kind === "singleFace"
  ) {
    return `${label} ${value}`;
  }
  return label;
}

function formatSlotsMultiplier(multiplier: number) {
  return `${multiplier.toFixed(2)}x`;
}

function formatSlotsSymbols(symbols: readonly number[], t: Translate) {
  return symbols.map((symbol) => t(`casino.room.selection.slots.symbols.${symbol}`)).join(" / ");
}

function getGameResultRows(context: GameResultContext, t: Translate) {
  if (context.casinoOutcome?.kind === "dice") {
    return [
      {
        label: t("casino.room.result.facts.diceTarget"),
        value: `${context.casinoOutcome.direction === "under" ? "≤" : ">"} ${context.casinoOutcome.target}`
      },
      {
        label: t("casino.room.result.facts.diceNumber"),
        value: context.casinoOutcome.rolls.map((roll) => roll.value).join(", "),
        tone: context.casinoOutcome.rolls.some((roll) => roll.won) ? "win" : "loss"
      }
    ] satisfies GameResultRow[];
  }

  if (context.casinoOutcome?.kind === "coin-toss") {
    return [
      {
        label: t("casino.room.result.facts.coinChoice"),
        value: formatCoinSide(context.casinoOutcome.chosen, t)
      },
      {
        label: t("casino.room.result.facts.coinDrawn"),
        value: context.casinoOutcome.rolls.map((roll) => formatCoinSide(roll.value, t)).join(", "),
        tone: context.casinoOutcome.rolls.some((roll) => roll.won) ? "win" : "loss"
      }
    ] satisfies GameResultRow[];
  }

  if (context.casinoOutcome?.kind === "roulette") {
    return [
      {
        label: t("casino.room.result.facts.rouletteBet"),
        value: formatList(context.casinoOutcome.selectedNumbers)
      },
      {
        label: t("casino.room.result.facts.rouletteWinningNumber"),
        value: context.casinoOutcome.rolls.map((roll) => roll.value).join(", "),
        tone: context.casinoOutcome.rolls.some((roll) => roll.won) ? "win" : "loss"
      }
    ] satisfies GameResultRow[];
  }

  if (context.casinoOutcome?.kind === "keno") {
    return [
      {
        label: t("casino.room.result.facts.kenoPicked"),
        value: formatList(context.casinoOutcome.pickedNumbers)
      },
      {
        label: t("casino.room.result.facts.kenoDrawn"),
        value: context.casinoOutcome.draws.map((draw) => draw.numbers.join(", ")).join(" / "),
        tone: context.casinoOutcome.draws.some((draw) => draw.won) ? "win" : "loss"
      },
      {
        label: t("casino.room.result.facts.kenoHits"),
        value: context.casinoOutcome.draws.map((draw) => draw.hits).join(", ")
      }
    ] satisfies GameResultRow[];
  }

  if (context.casinoOutcome?.kind === "plinko") {
    return [
      {
        label: t("casino.room.result.facts.plinkoRisk"),
        value: formatPlinkoRisk(context.casinoOutcome.risk, t)
      },
      {
        label: t("casino.room.result.facts.plinkoSlot"),
        value: context.casinoOutcome.rolls.map((roll) => roll.bucket).join(", "),
        tone:
          context.casinoOutcome.netResult > 0n
            ? "win"
            : context.casinoOutcome.netResult < 0n
              ? "loss"
              : "neutral"
      },
      {
        label: t("casino.room.result.facts.plinkoPath"),
        value: context.casinoOutcome.rolls.map((roll) => roll.path.join("")).join(" / ")
      },
      {
        label: t("casino.room.result.facts.plinkoMultiplier"),
        value: context.casinoOutcome.rolls
          .map((roll) => `${(roll.factorBps / 10_000).toFixed(roll.factorBps >= 100_000 ? 1 : 2)}x`)
          .join(", ")
      }
    ] satisfies GameResultRow[];
  }

  if (context.casinoOutcome?.kind === "baccarat") {
    return [
      {
        label: t("casino.room.result.facts.baccaratChoice"),
        value: formatBaccaratSide(context.casinoOutcome.side, t)
      },
      {
        label: t("casino.room.result.facts.baccaratWinner"),
        value: context.casinoOutcome.rolls
          .map((roll) => formatBaccaratSide(roll.outcome, t))
          .join(", "),
        tone:
          context.casinoOutcome.netResult > 0n
            ? "win"
            : context.casinoOutcome.netResult < 0n
              ? "loss"
              : "neutral"
      },
      {
        label: t("casino.room.result.facts.baccaratPlayerTotal"),
        value: context.casinoOutcome.rolls.map((roll) => roll.playerTotal).join(", ")
      },
      {
        label: t("casino.room.result.facts.baccaratBankerTotal"),
        value: context.casinoOutcome.rolls.map((roll) => roll.bankerTotal).join(", ")
      },
      {
        label: t("casino.room.result.facts.baccaratPlayerCards"),
        value: context.casinoOutcome.rolls.map((roll) => formatList(roll.playerCards)).join(" / ")
      },
      {
        label: t("casino.room.result.facts.baccaratBankerCards"),
        value: context.casinoOutcome.rolls.map((roll) => formatList(roll.bankerCards)).join(" / ")
      }
    ] satisfies GameResultRow[];
  }

  if (context.casinoOutcome?.kind === "slots") {
    return [
      {
        label: t("casino.room.result.facts.slotsProfile"),
        value: t(`casino.room.selection.slots.profiles.${context.casinoOutcome.profile}`)
      },
      {
        label: t("casino.room.result.facts.slotsSymbols"),
        value: context.casinoOutcome.rolls
          .map((roll) => formatSlotsSymbols(roll.symbols, t))
          .join(" / "),
        tone:
          context.casinoOutcome.netResult > 0n
            ? "win"
            : context.casinoOutcome.netResult < 0n
              ? "loss"
              : "neutral"
      },
      {
        label: t("casino.room.result.facts.slotsMultiplier"),
        value: context.casinoOutcome.rolls
          .map((roll) => formatSlotsMultiplier(roll.multiplier))
          .join(", ")
      },
      {
        label: t("casino.room.result.facts.slotsJackpot"),
        value: context.casinoOutcome.rolls.some((roll) => roll.jackpot)
          ? t("casino.room.selection.slots.yes")
          : t("casino.room.selection.slots.no"),
        tone: context.casinoOutcome.rolls.some((roll) => roll.jackpot) ? "win" : "neutral"
      }
    ] satisfies GameResultRow[];
  }

  if (context.casinoOutcome?.kind === "sic-bo") {
    return [
      {
        label: t("casino.room.result.facts.sicBoBet"),
        value: formatSicBoBet(context.casinoOutcome.betKind, context.casinoOutcome.betValue, t)
      },
      {
        label: t("casino.room.result.facts.sicBoDice"),
        value: context.casinoOutcome.rolls.map((roll) => roll.dice.join(" / ")).join(", "),
        tone:
          context.casinoOutcome.netResult > 0n
            ? "win"
            : context.casinoOutcome.netResult < 0n
              ? "loss"
              : "neutral"
      },
      {
        label: t("casino.room.result.facts.sicBoTotal"),
        value: context.casinoOutcome.rolls.map((roll) => roll.total).join(", ")
      },
      {
        label: t("casino.room.result.facts.sicBoTriple"),
        value: context.casinoOutcome.rolls
          .map((roll) =>
            roll.triple ? t("casino.room.selection.slots.yes") : t("casino.room.selection.slots.no")
          )
          .join(", ")
      },
      {
        label: t("casino.room.result.facts.sicBoMultiplier"),
        value: context.casinoOutcome.rolls
          .map((roll) => `${(roll.factorBps / 10_000).toFixed(roll.factorBps >= 100_000 ? 1 : 2)}x`)
          .join(", ")
      }
    ] satisfies GameResultRow[];
  }

  if (context.gameSlug === "dice") {
    const rows: GameResultRow[] = [
      {
        label: t("casino.room.result.facts.diceTarget"),
        value: `${context.diceDirection === "under" ? "<" : ">"} ${context.diceTarget}`
      }
    ];
    if (context.resultNum != null) {
      rows.push({
        label: t("casino.room.result.facts.diceNumber"),
        value: context.resultNum.toString(),
        tone: "accent" as const
      });
    }
    return rows;
  }

  if (context.gameSlug === "coin-toss") {
    const rows: GameResultRow[] = [
      {
        label: t("casino.room.result.facts.coinChoice"),
        value: formatCoinSide(context.coinSide, t)
      }
    ];
    if (context.resultNum != null) {
      rows.push({
        label: t("casino.room.result.facts.coinDrawn"),
        value: formatCoinSide(context.resultNum === 1 ? "HEADS" : "TAILS", t),
        tone: "accent" as const
      });
    }
    return rows;
  }

  if (context.gameSlug === "roulette") {
    const rows: GameResultRow[] = [
      {
        label: t("casino.room.result.facts.rouletteBet"),
        value: formatList(context.rouletteSpots)
      }
    ];
    if (context.resultNum != null) {
      rows.push({
        label: t("casino.room.result.facts.rouletteWinningNumber"),
        value: context.resultNum.toString(),
        tone: "accent" as const
      });
    }
    return rows;
  }

  if (context.gameSlug === "keno") {
    const hits = context.kenoResultDrawn.filter((n) => context.kenoSpots.includes(n)).length;
    const rows: GameResultRow[] = [
      {
        label: t("casino.room.result.facts.kenoPicked"),
        value: formatList(context.kenoSpots)
      }
    ];
    if (context.kenoResultDrawn.length > 0) {
      rows.push(
        {
          label: t("casino.room.result.facts.kenoDrawn"),
          value: formatList(context.kenoResultDrawn),
          tone: "accent" as const
        },
        {
          label: t("casino.room.result.facts.kenoHits"),
          value: hits.toString()
        }
      );
    }
    return rows;
  }

  return [];
}

/** Compact figure tile used in the settled-payoff stat strip. */
function Stat({ label, value, tone }: { label: string; value: string; tone?: DetailTone }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-subtle">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 truncate font-mono text-sm font-bold",
          tone === "win" && "text-success",
          tone === "loss" && "text-danger",
          tone === "accent" && "text-accent",
          (tone == null || tone === "neutral") && "text-fg"
        )}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

/** Dense label/value row for the game-result and fairness panels. */
function FactRow({
  label,
  value,
  href,
  tone
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
  tone?: DetailTone;
}) {
  // flex-1 + min-w-0 lets the value claim the row's remaining width and
  // truncate (e.g. the long request-id decimal) instead of overflowing.
  const valueClass = cn(
    "min-w-0 flex-1 truncate font-mono text-xs font-bold text-fg",
    tone === "win" && "text-success",
    tone === "loss" && "text-danger",
    tone === "accent" && "text-accent",
    tone === "neutral" && "text-fg-muted"
  );
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-xs text-fg-muted">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={cn(
            valueClass,
            "inline-flex items-center justify-end gap-1 text-brand hover:text-brand/80"
          )}
        >
          <span className="truncate">{value}</span>
          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 shrink-0" />
        </a>
      ) : (
        <span className={cn(valueClass, "text-right")}>{value}</span>
      )}
    </div>
  );
}

/** A titled, hairline-separated block in the result body. */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border-soft px-4 py-3">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function GameRoomResultOverlay({
  result,
  chainId,
  assetSymbol = "UNIT",
  assetDecimals = 6,
  gameSlug,
  resultNum,
  diceDirection,
  diceTarget,
  coinSide,
  rouletteSpots,
  kenoSpots,
  kenoResultDrawn,
  casinoOutcome,
  onClose,
  onPlayAgain
}: {
  result: CasinoTerminalRoundResult;
  chainId?: number;
  assetSymbol?: string;
  assetDecimals?: number;
  gameSlug: string;
  resultNum: number | null;
  diceDirection: DiceDirection;
  diceTarget: number;
  coinSide: CoinSide;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  kenoResultDrawn: readonly number[];
  casinoOutcome?: CasinoOutcome | null;
  onClose?: () => void;
  /** Restart the round (resets the stepper and places the next bet). */
  onPlayAgain?: () => void;
}) {
  const t = useTranslations();
  const [fairnessOpen, setFairnessOpen] = React.useState(false);
  const primaryActionRef = React.useRef<HTMLButtonElement | null>(null);
  const outcome = getOutcome(result, t);
  const gameLabel = t(`casino.room.names.${gameNameKeyFromSlug(gameSlug)}`);
  const receiptModel = buildCasinoReceiptFromTerminalResult({
    assetDecimals,
    assetSymbol,
    chainId,
    gameLabel,
    gameSlug,
    result
  });
  // The overlay only ever mounts for a fully settled or refunded round (the
  // caller gates it behind isCasinoTerminalRoundResult), so every figure here is
  // final — no pending / random-only states are represented.
  const txHash = receiptModel.terminalTxHash;
  const txHref = receiptModel.txHref;
  const payoutLabel =
    result.kind === "refunded"
      ? t("casino.room.result.facts.refund")
      : t("casino.room.result.facts.payout");
  const gameRows = getGameResultRows(
    {
      gameSlug,
      resultNum,
      diceDirection,
      diceTarget,
      coinSide,
      rouletteSpots,
      kenoSpots,
      kenoResultDrawn,
      casinoOutcome
    },
    t
  );
  const fairnessProof = buildFairnessProof({ result, chainId, txHash });
  const shareText = `${outcome.label} · ${receiptModel.signedNetValue} · ${receiptModel.gameLabel}`;
  const receiptPath = chainId
    ? buildReceiptSharePath({
        betId: result.betId,
        chainId
      })
    : undefined;
  const shareUrl = receiptPath
    ? buildShareUrl({
        href:
          typeof window !== "undefined" ? `${window.location.origin}${receiptPath}` : receiptPath,
        referrer: result.player
      })
    : "";
  useReceiptMaterialization({
    betId: result.betId,
    chainId,
    terminalTxHash: receiptModel.terminalTxHash
  });
  const closeOverlay = React.useCallback(() => onClose?.(), [onClose]);

  return (
    <Modal
      ariaLabel={t("casino.room.result.title")}
      initialFocusRef={primaryActionRef}
      onClose={closeOverlay}
      open
      panelClassName="relative flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-md border border-border bg-surface-1 shadow-e3"
    >
      {/* Header — quiet eyebrow + close, matching the room's panel chrome. */}
      <div className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
          {t("casino.room.result.title")}
        </span>
        <button
          type="button"
          onClick={closeOverlay}
          aria-label={t("casino.room.result.actions.close")}
          className="rounded-md border border-border-soft bg-surface-2 p-1.5 text-fg-muted transition-colors hover:border-brand/40 hover:text-fg"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 overflow-y-auto">
        {/* Hero — the settled payoff, led by net result. */}
        <div className="relative overflow-hidden border-b border-border-soft px-4 py-5">
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-6 -top-6 h-24 blur-[70px]",
              outcome.tone === "win" && "bg-success/30",
              outcome.tone === "loss" && "bg-danger/25",
              outcome.tone === "neutral" && "bg-brand/20"
            )}
          />
          <div className="relative">
            <span
              role="status"
              aria-live="assertive"
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]",
                outcome.tone === "win" && "border-success/40 bg-success-soft text-success",
                outcome.tone === "loss" && "border-danger/40 bg-danger-soft text-danger",
                outcome.tone === "neutral" && "border-border-soft bg-surface-2 text-fg-muted"
              )}
            >
              {outcome.label}
            </span>
            <div
              className={cn(
                "mt-2 truncate font-mono text-3xl font-bold",
                outcome.tone === "win" && "text-success",
                outcome.tone === "loss" && "text-danger",
                outcome.tone === "neutral" && "text-fg"
              )}
              title={receiptModel.signedNetValue}
            >
              {receiptModel.signedNetValue}
            </div>
            <p className="mt-1.5 text-xs leading-5 text-fg-muted">{outcome.detail}</p>
          </div>
        </div>

        {/* Stat strip — stake / payout / multiplier. */}
        <div className="grid grid-cols-3 divide-x divide-border-soft border-b border-border-soft">
          <Stat label={t("casino.room.result.facts.betAmount")} value={receiptModel.stakeValue} />
          <Stat
            label={payoutLabel}
            value={receiptModel.payoutValue}
            tone={outcome.tone === "win" ? "win" : "neutral"}
          />
          <Stat
            label={t("casino.room.result.facts.multiplier")}
            value={receiptModel.multiplierValue}
          />
        </div>

        {gameRows.length > 0 && (
          <Panel title={t("casino.room.result.sections.gameResult")}>
            {gameRows.map((row) => (
              <FactRow key={row.label} label={row.label} value={row.value} tone={row.tone} />
            ))}
          </Panel>
        )}

        {/* Verifiable fairness facts — collapsed by default so the result
              reads clean; expandable to inspect and copy the chain receipt. */}
        <div className="border-b border-border-soft px-4 py-3">
          <button
            type="button"
            onClick={() => setFairnessOpen((open) => !open)}
            aria-expanded={fairnessOpen}
            className="flex w-full items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle transition-colors hover:text-fg"
          >
            <span>{t("casino.room.result.sections.fairnessData")}</span>
            <ChevronDownIcon
              className={cn("h-4 w-4 transition-transform", fairnessOpen && "rotate-180")}
            />
          </button>
          {fairnessOpen ? (
            <div className="mt-2 space-y-1.5">
              <FactRow
                label={t("casino.room.result.facts.player")}
                value={formatAddress(receiptModel.player)}
              />
              <FactRow label={t("casino.room.result.facts.betId")} value={receiptModel.betId} />
              <FactRow
                label={t("casino.room.result.facts.settlementTx")}
                value={shortHash(receiptModel.terminalTxHash)}
                href={txHref}
              />
              <FactRow
                label={t("casino.room.result.facts.randomHash")}
                value={shortHash(receiptModel.randomHash)}
              />
              <FactRow
                label={t("casino.room.result.facts.requestId")}
                value={receiptModel.requestId ?? "—"}
              />
              <FactRow
                label={t("casino.room.result.facts.resolvedTime")}
                value={formatResolvedAt(receiptModel.resolvedAt)}
              />
              <FactRow
                label={t("casino.room.result.facts.vrfFee")}
                value={formatNativeFee(result.vrfFeeCharged)}
              />
              <div className="pt-2.5">
                <CopyProofButton
                  proof={fairnessProof}
                  label={t("casino.room.result.actions.copyProof")}
                  copiedLabel={t("casino.room.result.actions.proofCopied")}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Actions — play again restarts the round; share offers the result;
            close dismisses. There is no settlement-status button: the modal only
            opens once settlement is final, and the settlement tx now lives in
            the fairness panel. */}
      <div className="space-y-2 border-t border-border-soft p-3">
        <button
          type="button"
          ref={primaryActionRef}
          onClick={onPlayAgain ?? onClose}
          className="w-full rounded-md border border-brand/40 bg-brand px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-fg-inverse shadow-e1 transition-colors hover:bg-brand-hover"
        >
          {t("casino.room.result.actions.playAgain")}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <SharePanel
            disabled={!receiptPath}
            desktopLayer="modal"
            title={t("casino.room.result.title")}
            text={shareText}
            url={shareUrl}
            proof={fairnessProof}
            labels={{
              close: t("casino.room.result.actions.close"),
              copyLink: t("casino.room.result.actions.copyResultLink"),
              copyProof: t("casino.room.result.actions.copyProof"),
              linkCopied: t("casino.room.result.actions.linkCopied"),
              nativeShare: t("casino.room.result.actions.nativeShare"),
              proofCopied: t("casino.room.result.actions.proofCopied"),
              share: t("casino.room.result.actions.share"),
              telegram: t("casino.room.result.actions.shareToTelegram"),
              whatsapp: t("casino.room.result.actions.shareToWhatsApp"),
              x: t("casino.room.result.actions.shareToX")
            }}
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border-soft bg-surface-2 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-fg transition-colors hover:border-brand/40 hover:bg-surface-3"
          >
            {t("casino.room.result.actions.close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function buildReceiptSharePath({ betId, chainId }: { betId: bigint; chainId: number }) {
  return `/casino/receipt/${chainId}/${betId.toString()}`;
}
