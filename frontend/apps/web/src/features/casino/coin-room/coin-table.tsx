"use client";

import * as React from "react";

import { fractionDigits, splitAmount } from "../../home/receipts";
import { PrintedFigure } from "../../home/printed-figure";
import type { CasinoOutcome } from "../room/outcome";
import type { CoinSide } from "../room/params";
import type { PlaceBetButtonPhase } from "../room/place-bet-button";
import { PaidChips, reducedMotion, SoundButton, useTableSound } from "../table-room/table-controls";
import { awaitsNumber, celebrate, type Celebration } from "../table-room/table-model";
import { useCoinCopy, type Flip } from "./coin-copy";
import { CoinFace } from "./coin-face";
import { COIN_CHANCE, matchMultiplier, SIDES, sideKey } from "./coin-model";
import { createFlipMotion, type FlipMotion } from "./flip-motion";

type CoinOutcome = Extract<CasinoOutcome, { kind: "coin-toss" }>;

/** The last results the table shows, newest first: this visit only. */
const HISTORY = 12;
/** The coin's thickness in px, and the discs that make its reeded edge. */
const THICK = 12;
const LAYERS = 12;
const EDGE = Array.from({ length: LAYERS }, (_, k) => -THICK / 2 + ((k + 0.5) * THICK) / LAYERS);

const flipsOf = (outcome: CoinOutcome): Flip[] =>
  outcome.rolls.map((roll) => ({ tails: roll.value === "TAILS", match: roll.won }));

/**
 * The coin toss table: the coin over a ring printed on the felt under the lamp, with the figures,
 * the status and the last results beside it, and the call as two spots printed below. The coin
 * follows the bet's chain state (flip-motion.ts): it spins in the air until the random number
 * arrives, then comes down on the side the number chose, flip after flip. A net win is paid on
 * the felt beside your chip; the slip beside it is the proof, and the table never holds it up.
 */
export function CoinTable({
  side,
  onSideChange,
  houseEdgeBps,
  houseEdgeRate,
  locked,
  phase,
  outcome,
  revealing,
  decimals,
  symbol,
  onRolling,
  onLanded
}: {
  side: CoinSide;
  onSideChange: (side: CoinSide) => void;
  houseEdgeBps: number | undefined;
  houseEdgeRate: string;
  locked: boolean;
  phase: PlaceBetButtonPhase;
  /** The bet's outcome, once the random number has been read. */
  outcome: CoinOutcome | null;
  /** The room waits for the table to show `outcome` before it prints the receipt. */
  revealing: boolean;
  decimals: number;
  symbol: string;
  /** The coin has started down for the result; the receipt waits for it. */
  onRolling: () => void;
  /** The last flip lies flat. */
  onLanded: () => void;
}) {
  const copy = useCoinCopy();
  const { t } = copy;
  const titleId = React.useId();
  const callId = React.useId();
  const historyId = React.useId();
  const feltRef = React.useRef<HTMLElement>(null);
  const callsRef = React.useRef<HTMLDivElement>(null);
  const coinRef = React.useRef<HTMLDivElement>(null);
  const shadowRef = React.useRef<HTMLDivElement>(null);
  const paidRef = React.useRef<HTMLSpanElement>(null);
  const frameRef = React.useRef(0);
  const motionRef = React.useRef<FlipMotion | null>(null);
  const playedRef = React.useRef<CoinOutcome | null>(null);
  const sound = useTableSound();
  const soundEngine = sound.engine;

  const [up, setUp] = React.useState<{ tails: boolean; won: boolean } | null>(null);
  const [landed, setLanded] = React.useState<Flip[]>([]);
  const [falling, setFalling] = React.useState(false);
  const [round, setRound] = React.useState<{ k: number; n: number } | null>(null);
  const [done, setDone] = React.useState(false);
  const [paid, setPaid] = React.useState<Celebration | null>(null);
  const [history, setHistory] = React.useState<Array<Flip & { id: number }>>([]);
  const nextId = React.useRef(0);
  const record = React.useCallback((flips: readonly Flip[]) => {
    setHistory((list) =>
      [...flips.map((flip) => ({ ...flip, id: nextId.current++ })).reverse(), ...list].slice(
        0,
        HISTORY
      )
    );
  }, []);

  const draw = React.useCallback(() => {
    const motion = motionRef.current;
    const coin = coinRef.current;
    const shadow = shadowRef.current;
    if (!motion || !coin || !shadow) return;
    const lift = Math.max(0, motion.height);
    coin.style.transform = `translateY(${(-lift * 18).toFixed(2)}px) scale(${(1 + lift * 0.42).toFixed(4)}) rotateX(${motion.angle.toFixed(2)}deg) rotateY(${motion.wobble.toFixed(2)}deg)`;
    shadow.style.transform = `translate(${(lift * 22).toFixed(2)}px, ${(lift * 30).toFixed(2)}px) scale(${(1 - lift * 0.3).toFixed(4)})`;
    shadow.style.opacity = (0.95 - lift * 0.55).toFixed(3);
  }, []);

  // One frame loop, while the coin moves.
  const loop = React.useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    const step = (now: number) => {
      const motion = motionRef.current;
      if (!motion) return;
      motion.tick(now);
      draw();
      if (motion.active) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }, [draw]);

  // The latest callbacks, for the flip's events.
  const latest = React.useRef({ onLanded, onRolling });
  latest.current = { onLanded, onRolling };

  /** Clear the lit spot and the paid chips. */
  const clear = React.useCallback(() => {
    setUp(null);
    setLanded([]);
    setRound(null);
    setFalling(false);
    setDone(false);
    setPaid(null);
  }, []);

  // The last side lights its spot; your chip turns red only when it matched and the bet as a
  // whole won, and the chips are paid beside it.
  const settle = React.useCallback((current: CoinOutcome, flips: readonly Flip[]) => {
    const win = celebrate(current);
    const last = flips.at(-1);
    if (last) setUp({ tails: last.tails, won: Boolean(win) && last.match });
    setPaid(win);
  }, []);

  React.useEffect(() => {
    const motion = createFlipMotion({
      // Wrapped: a browser's timer functions throw when called as another object's method.
      timers: {
        setTimeout: (run, ms) => setTimeout(run, ms),
        clearTimeout: (timer) => clearTimeout(timer)
      },
      reduced: reducedMotion(),
      events: {
        onToss: () => soundEngine.current?.flick(),
        onLand: (i) => {
          const current = playedRef.current;
          if (!current) return;
          const flip = flipsOf(current)[i];
          if (!flip) return;
          setUp({ tails: flip.tails, won: false });
          setLanded((list) => [...list, flip]);
          record([flip]);
          soundEngine.current?.coin(flip.match);
          const n = current.rolls.length;
          if (n > 1) setRound({ k: Math.min(i + 2, n), n });
        },
        onDone: () => {
          const current = playedRef.current;
          setRound(null);
          setFalling(false);
          setDone(true);
          if (current) settle(current, flipsOf(current));
          // Drawn here too: at the deadline the coin is laid flat with no frame to follow.
          draw();
          latest.current.onLanded();
        }
      }
    });
    motionRef.current = motion;
    draw();
    return () => {
      cancelAnimationFrame(frameRef.current);
      motion.dispose();
      motionRef.current = null;
    };
  }, [draw, record, settle, soundEngine]);

  // Waiting for the random number: the coin is tossed and spins. It lies flat again for a
  // refund, and keeps spinning when the number arrives; the flip down starts from there.
  const waiting = awaitsNumber(phase) && !outcome;
  const hasOutcome = Boolean(outcome);
  React.useEffect(() => {
    const motion = motionRef.current;
    if (!motion || !waiting) {
      if (motion?.spinning && !hasOutcome) {
        motion.reset();
        draw();
      }
      return;
    }
    playedRef.current = null;
    clear();
    motion.wait();
    draw();
    loop();
    // On a phone the table goes to the top of the screen, so the coin and the spots sit above
    // the docked slip; elsewhere it comes into view.
    const felt = feltRef.current;
    const calls = callsRef.current;
    const slip = document.querySelector("[data-slip]");
    const docked = slip ? getComputedStyle(slip).position === "fixed" : false;
    if (felt && calls) {
      const top = felt.getBoundingClientRect().top;
      const off = docked
        ? Math.abs(top) > 2
        : top < 0 || calls.getBoundingClientRect().bottom > window.innerHeight;
      if (off)
        felt.scrollIntoView?.({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
    }
  }, [clear, draw, hasOutcome, loop, waiting]);

  // The number is in: bring the coin down on each flip's side. A result shown before this table
  // mounted is laid on its last side.
  React.useEffect(() => {
    const motion = motionRef.current;
    if (!motion) return;
    if (!outcome) {
      if (playedRef.current) {
        playedRef.current = null;
        motion.reset();
        clear();
        draw();
      }
      return;
    }
    if (playedRef.current === outcome) return;
    playedRef.current = outcome;
    const flips = flipsOf(outcome);
    clear();
    if (flips.length === 0) return;
    if (outcome.chosen !== side) onSideChange(outcome.chosen);
    const sides = flips.map((flip) => flip.tails);
    if (revealing || motion.spinning) {
      latest.current.onRolling();
      setFalling(true);
      if (flips.length > 1) setRound({ k: 1, n: flips.length });
      motion.play(sides);
      loop();
    } else {
      motion.place(sides);
      setLanded(flips);
      record(flips);
      setDone(true);
      settle(outcome, flips);
      draw();
    }
    // `revealing` and the call are read once per outcome.
  }, [clear, draw, loop, outcome, record, settle]);

  // Changing the call after a result clears the spots for the next bet; the coin stays as it lay.
  const choose = (next: CoinSide) => {
    if (next === side) return;
    if (done || landed.length > 0) clear();
    onSideChange(next);
  };

  const status: React.ReactNode = waiting
    ? t("table.status.waiting")
    : round
      ? t("table.flip", { k: round.k, n: round.n })
      : falling
        ? t("table.status.falling")
        : done && outcome && landed.length > 0
          ? copy.landedPrint(landed, outcome.chosen)
          : locked
            ? ""
            : t("table.status.ready");
  const net = paid
    ? splitAmount(paid.net, decimals, Math.max(2, fractionDigits(paid.net, decimals)))
    : null;
  const multiple = houseEdgeBps != null ? matchMultiplier(houseEdgeBps) : null;
  const multipleText = multiple
    ? multiple.fraction
      ? `${multiple.whole}.${multiple.fraction}`
      : multiple.whole
    : "–";
  const [chanceWhole, chanceTenth] = COIN_CHANCE.split(".");
  const figure =
    "font-print text-[30px] leading-none font-extrabold text-print @max-[460px]/felt:text-[24px]";
  const figLabel = "text-note leading-tight text-print-soft @max-[460px]/felt:text-[12px]";

  return (
    <section
      ref={feltRef}
      aria-labelledby={titleId}
      className="table-felt @container/felt relative isolate overflow-hidden px-8 pt-7 pb-4 max-[720px]:px-3 max-[720px]:pt-[18px]"
    >
      <h2 id={titleId} className="sr-only">
        {t("table.title")}
      </h2>
      <div
        aria-hidden="true"
        className={`table-lamp pointer-events-none absolute inset-[-24%_8%_28%] -z-10 ${
          paid
            ? paid.big
              ? "motion-safe:animate-lamp-warm-big"
              : "motion-safe:animate-lamp-warm"
            : ""
        }`}
      />

      <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] items-start gap-x-[26px] gap-y-3.5 [grid-template-areas:'stage_head'_'stage_foot'] @max-[620px]/felt:grid-cols-1 @max-[620px]/felt:[grid-template-areas:'head'_'stage'_'foot']">
        <div className="flex min-w-0 flex-wrap gap-x-6 gap-y-2 [grid-area:head] @max-[460px]/felt:gap-x-[22px] @max-[460px]/felt:gap-y-1">
          <p className="grid gap-2 @max-[460px]/felt:gap-1">
            <span className={figLabel}>{t("table.chance")}</span>
            <span className={figure}>
              <PrintedFigure
                value={{ whole: chanceWhole!, fraction: chanceTenth!, sign: "" }}
                suffix="%"
              />
            </span>
          </p>
          <p className="grid gap-2 @max-[460px]/felt:gap-1">
            <span className={figLabel}>{t("table.pays")}</span>
            <span className={figure}>
              {multiple ? <PrintedFigure value={multiple} suffix="×" /> : "–"}
            </span>
          </p>
        </div>

        <div aria-hidden="true" className="table-coin [grid-area:stage]">
          <div data-c="ring" />
          <div ref={shadowRef} data-c="shadow" />
          <div ref={coinRef} data-c="coin">
            <div data-c="face" style={{ transform: `translateZ(${THICK / 2}px)` }}>
              <CoinFace side="HEADS" />
            </div>
            {EDGE.map((z) => (
              <div key={z} data-c="edge" style={{ transform: `translateZ(${z.toFixed(2)}px)` }} />
            ))}
            <div data-c="face" style={{ transform: `rotateX(180deg) translateZ(${THICK / 2}px)` }}>
              <CoinFace side="TAILS" />
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-2.5 [grid-area:foot]">
          {net && paid ? (
            <p
              aria-hidden="true"
              data-big={paid.big || undefined}
              className={`table-pay-glow text-[34px] leading-none whitespace-nowrap text-print @max-[620px]/felt:text-[28px] @max-[460px]/felt:hidden ${
                paid.big ? "motion-safe:animate-pay-pulse" : "motion-safe:animate-pay-in"
              }`}
            >
              <PrintedFigure value={{ ...net, sign: "+" }} />
              <small className="ml-1.5 font-text text-note font-semibold">{symbol}</small>
            </p>
          ) : null}
          <p
            aria-hidden="true"
            className="min-h-[1.45em] max-w-[22em] text-note leading-normal text-print-soft @max-[460px]/felt:hidden"
          >
            {status}
          </p>
          <div className="flex min-w-0 items-center gap-2.5">
            <SoundButton
              sound={sound}
              compact="w-8 flex-none justify-center px-0! [&_[data-label]]:sr-only @max-[460px]/felt:size-[30px]"
            />
            <div className="min-w-0">
              <p id={historyId} className="sr-only">
                {t("table.history")}
              </p>
              <ol
                aria-labelledby={historyId}
                className="m-0 flex list-none flex-nowrap gap-[5px] overflow-hidden p-0"
              >
                {history.length === 0 ? (
                  <li className="text-note whitespace-nowrap text-print-soft">
                    {t("table.noHistory")}
                  </li>
                ) : (
                  history.map((item) => {
                    const up = item.tails ? "TAILS" : "HEADS";
                    return (
                      <li key={item.id} className="flex flex-none">
                        <span data-paid={item.match || undefined} className="table-minicoin">
                          <span className="sr-only">
                            {t(item.match ? "table.tileMatch" : "table.tile", {
                              face: copy.face(up)
                            })}
                          </span>
                          <CoinFace side={up} />
                        </span>
                      </li>
                    );
                  })
                )}
              </ol>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={callsRef}
        role="group"
        aria-labelledby={callId}
        className="mt-[18px] grid grid-cols-2 gap-3 @max-[460px]/felt:mt-3 @max-[460px]/felt:gap-2"
      >
        <span id={callId} className="sr-only">
          {t("table.call")}
        </span>
        {SIDES.map((face) => {
          const chosen = face === side;
          const isUp = up != null && up.tails === (face === "TAILS");
          return (
            <button
              key={face}
              type="button"
              className="table-call"
              aria-pressed={chosen}
              aria-label={t("table.spotLabel", { face: copy.face(face), m: multipleText })}
              disabled={locked}
              data-up={isUp || undefined}
              data-won={(isUp && up?.won) || undefined}
              onClick={() => choose(face)}
            >
              <span data-mini>
                <CoinFace side={face} />
              </span>
              <span className="min-w-0">
                <span data-name>{t(`table.face.${sideKey(face)}`)}</span>
                <span data-sub>{t("table.spot", { m: multipleText })}</span>
              </span>
              <span data-chip aria-hidden="true">
                {chosen ? <span ref={paidRef} data-pay /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-center text-note leading-snug text-print-soft max-[720px]:text-[12px]">
        {t("table.rule", { rate: houseEdgeRate })}
      </p>
      {paid ? (
        <PaidChips
          key={`${side}-${history.length}`}
          count={paid.chips}
          feltRef={feltRef}
          spotRef={paidRef}
          sound={soundEngine}
        />
      ) : null}
    </section>
  );
}
