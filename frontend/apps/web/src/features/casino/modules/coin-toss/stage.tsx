import * as React from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { cn } from "@ssot/ui";
import { useTranslations } from "next-intl";

import type { CoinSide } from "../../room/params";

/** Hairline section divider that fades out at both ends. */
function Divider() {
  return (
    <div
      aria-hidden
      className="mx-5 h-px"
      style={{ background: "linear-gradient(90deg, transparent, hsl(var(--border)), transparent)" }}
    />
  );
}

/**
 * CoinFace — a minted medallion drawn as scalable SVG so it stays crisp on the
 * large flipping disc and the small choice tiles alike. HEADS is brand-toned
 * metal, TAILS accent-toned; each carries a milled rim and an embossed
 * monogram instead of a generic icon.
 */
function CoinFace({ side }: { side: CoinSide }) {
  const uid = React.useId();
  const heads = side === "HEADS";
  const tone = heads ? "var(--brand)" : "var(--accent)";
  const mono = heads ? "H" : "T";
  const metalId = `cm-${uid}`;
  const fieldId = `cf-${uid}`;
  const monoFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id={metalId} cx="36%" cy="28%" r="82%">
          <stop offset="0%" stopColor="hsl(var(--fg) / 0.6)" />
          <stop offset="44%" stopColor={`hsl(${tone})`} />
          <stop offset="100%" stopColor={`hsl(${tone} / 0.6)`} />
        </radialGradient>
        <radialGradient id={fieldId} cx="40%" cy="32%" r="78%">
          <stop offset="0%" stopColor={`hsl(${tone} / 0.92)`} />
          <stop offset="100%" stopColor={`hsl(${tone} / 0.5)`} />
        </radialGradient>
      </defs>
      {/* metal disc */}
      <circle cx="60" cy="60" r="60" fill={`url(#${metalId})`} />
      {/* milled edge */}
      <circle
        cx="60"
        cy="60"
        r="53.5"
        fill="none"
        stroke="hsl(var(--surface-0) / 0.6)"
        strokeWidth="9"
        strokeDasharray="1.7 3.1"
        strokeLinecap="round"
      />
      {/* bevel ring + recessed field */}
      <circle
        cx="60"
        cy="60"
        r="46.5"
        fill="none"
        stroke="hsl(var(--fg) / 0.28)"
        strokeWidth="1.3"
      />
      <circle cx="60" cy="60" r="45" fill={`url(#${fieldId})`} />
      {/* embossed monogram — dark drop then bright relief */}
      <text
        x="60"
        y="64.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="60"
        fontWeight="800"
        fontFamily={monoFamily}
        fill="hsl(var(--surface-0) / 0.5)"
      >
        {mono}
      </text>
      <text
        x="60"
        y="62"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="60"
        fontWeight="800"
        fontFamily={monoFamily}
        fill="hsl(var(--fg) / 0.92)"
      >
        {mono}
      </text>
    </svg>
  );
}

export function CoinTossStage({
  isPending,
  isRevealing,
  showResult,
  resultNum,
  coinSide,
  onSideChange,
  onRevealComplete
}: {
  isPending: boolean;
  isRevealing?: boolean;
  showResult: boolean;
  resultNum: number | null;
  coinSide: CoinSide;
  onSideChange: (side: CoinSide) => void;
  onRevealComplete?: () => void;
}) {
  const t = useTranslations();
  const reduced = useReducedMotion() ?? false;
  const spinning = isPending || Boolean(isRevealing);
  const controlsDisabled = spinning || showResult;
  const selectedSideLabel =
    coinSide === "HEADS"
      ? t("casino.room.selection.coin.heads")
      : t("casino.room.selection.coin.tails");

  React.useEffect(() => {
    if (!isRevealing || resultNum == null) return;
    const timeout = window.setTimeout(() => onRevealComplete?.(), 1_250);
    return () => window.clearTimeout(timeout);
  }, [isRevealing, onRevealComplete, resultNum]);

  return (
    <div className="absolute inset-0 z-10 overflow-y-auto custom-scrollbar">
      {/* Stage atmosphere — a top-down lift and a soft brand bloom. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 80% at 50% -8%, hsl(var(--surface-2)), hsl(var(--surface-0)) 60%)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-12 h-[420px] w-[620px] max-w-full -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--brand) / 0.13), transparent 68%)" }}
      />

      <div className="relative flex min-h-full items-center justify-center px-4 py-6">
        <div
          className="relative w-full max-w-[480px] overflow-hidden rounded-xl border border-border-soft shadow-e3"
          style={{
            background: "linear-gradient(180deg, hsl(var(--surface-2)), hsl(var(--surface-1)))"
          }}
        >
          {/* top edge sheen */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, hsl(var(--fg) / 0.16), transparent)"
            }}
          />

          {/* Coin zone — generous headroom above the rest pose for the toss arc. */}
          <div className="relative px-5 pb-12 pt-[84px]">
            {/* energy bloom while tossing */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-7 h-[230px] w-[270px] -translate-x-1/2 rounded-full transition-opacity duration-500"
              style={{
                opacity: spinning ? 1 : 0,
                background: "radial-gradient(circle, hsl(var(--brand) / 0.3), transparent 70%)"
              }}
            />

            <div
              className="relative mx-auto h-[168px] w-[168px]"
              style={{ perspective: "1200px" }}
              aria-hidden
            >
              {/* Felt landing pad */}
              <div className="pointer-events-none absolute bottom-[-38px] left-1/2 h-[64px] w-[132%] -translate-x-1/2">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "hsl(var(--surface-0))",
                    boxShadow:
                      "inset 0 2px 10px hsl(var(--surface-0) / 0.6), 0 6px 22px hsl(var(--surface-0) / 0.5)"
                  }}
                />
                <div
                  className="absolute inset-1 rounded-full"
                  style={{
                    background:
                      "radial-gradient(ellipse at 50% 22%, hsl(var(--surface-2)), hsl(var(--surface-0)))"
                  }}
                />
              </div>

              {/* Landing shadow */}
              <motion.div
                aria-hidden
                className="pointer-events-none absolute bottom-1 left-1/2 h-3 w-3/5 rounded-full blur-md"
                style={{ background: "hsl(var(--surface-0) / 0.55)" }}
                initial={false}
                animate={{ x: "-50%", scale: spinning ? 0.7 : 1, opacity: spinning ? 0.4 : 0.75 }}
                transition={{ duration: 0.5 }}
              />

              <CoinDisc
                spinning={spinning}
                isRevealing={Boolean(isRevealing)}
                showResult={showResult}
                resultNum={resultNum}
                coinSide={coinSide}
                reduced={reduced}
              />
            </div>
          </div>

          <Divider />

          {/* Choice zone — status line then the HEADS / TAILS selector. */}
          <div className="px-5 py-4">
            <div className="mb-3 flex items-center justify-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: coinSide === "HEADS" ? "hsl(var(--brand))" : "hsl(var(--accent))"
                }}
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-fg-muted">
                {spinning
                  ? t("casino.room.stage.coin.waitingVrf")
                  : t("casino.room.stage.coin.selected", { side: selectedSideLabel })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <CoinChoiceTile
                side="HEADS"
                label={t("casino.room.selection.coin.heads")}
                active={coinSide === "HEADS"}
                disabled={controlsDisabled}
                onClick={() => onSideChange("HEADS")}
              />
              <CoinChoiceTile
                side="TAILS"
                label={t("casino.room.selection.coin.tails")}
                active={coinSide === "TAILS"}
                disabled={controlsDisabled}
                onClick={() => onSideChange("TAILS")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * CoinDisc — a real tossed coin.
 *
 * The coin flips end-over-end on the X axis with a vertical toss arc, rather
 * than spinning flat. Rotation is driven through a motion value so each phase
 * continues forward from the last: idle settle → continuous toss while VRF is
 * pending → a final arc that lands on the result face. `prefers-reduced-motion`
 * snaps to the correct face. The flip physics below are unchanged — only the
 * coin's surface material was restyled.
 */
function CoinDisc({
  spinning,
  isRevealing,
  showResult,
  resultNum,
  coinSide,
  reduced
}: {
  spinning: boolean;
  isRevealing: boolean;
  showResult: boolean;
  resultNum: number | null;
  coinSide: CoinSide;
  reduced: boolean;
}) {
  const restRotateX = coinSide === "TAILS" ? 180 : 0;
  const resultRotateX = resultNum === 1 ? 0 : 180;
  const rotateX = useMotionValue(restRotateX);
  const liftY = useMotionValue(0);

  const phase = isRevealing ? "reveal" : spinning ? "pending" : showResult ? "resolved" : "idle";

  React.useEffect(() => {
    const forward = (target: number) => {
      const current = rotateX.get();
      return current + ((((target - current) % 360) + 360) % 360);
    };

    if (reduced) {
      rotateX.set(phase === "reveal" || phase === "resolved" ? resultRotateX : restRotateX);
      liftY.set(0);
      return;
    }

    const running: Array<{ stop: () => void }> = [];

    if (phase === "pending") {
      running.push(
        animate(rotateX, rotateX.get() + 100_000, { duration: 100_000 / 760, ease: "linear" }),
        animate(liftY, [0, -24, 0], { duration: 0.62, ease: "easeInOut", repeat: Infinity })
      );
    } else if (phase === "reveal" && resultNum != null) {
      running.push(
        animate(rotateX, rotateX.get() + 1_080 + forward(resultRotateX), {
          duration: 1.05,
          ease: [0.16, 0.84, 0.3, 1]
        }),
        animate(liftY, [0, -82, 12, 0], {
          duration: 1.1,
          times: [0, 0.42, 0.85, 1],
          ease: "easeInOut"
        })
      );
    } else {
      const target = phase === "resolved" && resultNum != null ? resultRotateX : restRotateX;
      running.push(
        animate(rotateX, forward(target), { type: "spring", stiffness: 90, damping: 15 }),
        animate(liftY, 0, { duration: 0.4, ease: "easeOut" })
      );
    }

    return () => running.forEach((controls) => controls.stop());
  }, [phase, reduced, resultNum, restRotateX, resultRotateX, rotateX, liftY]);

  return (
    <motion.div
      className="relative h-full w-full"
      style={{ transformStyle: "preserve-3d", rotateX, rotateZ: -6, y: liftY }}
    >
      {/* Coin edge — stacked rings give the disc real thickness and milling. */}
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-full border-[6px]"
          style={{
            transform: `translateZ(${15 - i}px)`,
            borderColor: i % 2 === 0 ? "hsl(var(--fg) / 0.22)" : "hsl(var(--surface-0))"
          }}
        />
      ))}

      {/* Heads face */}
      <div
        className="[backface-visibility:hidden] absolute inset-0 overflow-hidden rounded-full shadow-e3"
        style={{ transform: "translateZ(16px)" }}
      >
        <CoinFace side="HEADS" />
      </div>

      {/* Tails face */}
      <div
        className="[backface-visibility:hidden] absolute inset-0 overflow-hidden rounded-full shadow-e3"
        style={{ transform: "rotateX(180deg) translateZ(16px)" }}
      >
        <CoinFace side="TAILS" />
      </div>
    </motion.div>
  );
}

function CoinChoiceTile({
  side,
  label,
  active,
  disabled,
  onClick
}: {
  side: CoinSide;
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const heads = side === "HEADS";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      style={
        active && !heads
          ? {
              boxShadow:
                "0 0 0 1px hsl(var(--accent) / 0.5), 0 10px 26px -6px hsl(var(--accent) / 0.45)"
            }
          : undefined
      }
      className={cn(
        "flex items-center gap-3 rounded-lg p-3 text-left transition-[transform,box-shadow,background-color]",
        active
          ? heads
            ? "bg-brand-soft shadow-glow ring-1 ring-inset ring-brand"
            : "bg-accent/15 ring-1 ring-inset ring-accent"
          : "bg-surface-3 shadow-e1 ring-1 ring-inset ring-border-soft",
        !active && !disabled && "hover:-translate-y-0.5 hover:shadow-e2 hover:ring-brand/40",
        disabled && "cursor-default opacity-60"
      )}
    >
      <span className="h-12 w-12 shrink-0">
        <CoinFace side={side} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "text-base font-bold uppercase tracking-wide",
            active ? "text-fg" : "text-fg-muted"
          )}
        >
          {label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
          {side}
        </span>
      </span>
    </button>
  );
}
