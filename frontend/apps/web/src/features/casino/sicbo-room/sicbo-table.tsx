"use client";

import * as React from "react";

import { fractionDigits, splitAmount } from "../../home/receipts";
import { PrintedFigure } from "../../home/printed-figure";
import type { PlaceBetButtonPhase } from "../room/place-bet-phase";
import { PaidChips, reducedMotion, SoundButton, useTableSound } from "../table-room/table-controls";
import { awaitsNumber, celebrate, type Celebration } from "../table-room/table-model";
import { createRollMotion, type RollMotion } from "./roll-motion";
import { useSicBoCopy, type Roll } from "./sicbo-copy";
import { DieCube, MiniDie } from "./sicbo-die";
import {
  areaChance,
  areaKey,
  areaMultiplier,
  diceTotal,
  factorOf,
  multiplierText,
  ROWS,
  sameArea,
  type Area,
  type Dice,
  type SicBoOutcome
} from "./sicbo-model";

/** The last results the table shows, newest first: this visit only. */
const HISTORY = 8;

const rollsOf = (outcome: SicBoOutcome): Roll[] =>
  outcome.rolls.map((roll) => ({ dice: roll.dice, won: roll.won }));

/**
 * The sic bo table: a dark dish under a glass dome at the top left, what you bet on beside it,
 * and the layout printed on the felt below, as at a real table. The dice follow the bet's chain
 * state (roll-motion.ts): the dome is shaken until the random number arrives, then the dice
 * settle on the faces it chose and the dome lifts. Every area the dice make true lights; a net
 * win is paid on your chip. The slip beside the table is the proof, and the table never holds it
 * up.
 */
export function SicBoTable({
  area,
  onAreaChange,
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
  area: Area;
  onAreaChange: (area: Area) => void;
  houseEdgeBps: number | undefined;
  houseEdgeRate: string;
  locked: boolean;
  phase: PlaceBetButtonPhase;
  /** The bet's outcome, once the random number has been read. */
  outcome: SicBoOutcome | null;
  /** The room waits for the table to show `outcome` before it prints the receipt. */
  revealing: boolean;
  decimals: number;
  symbol: string;
  /** The dice have started down for the result; the receipt waits for them. */
  onRolling: () => void;
  /** The last roll counts. */
  onLanded: () => void;
}) {
  const copy = useSicBoCopy();
  const { t } = copy;
  const titleId = React.useId();
  const layoutId = React.useId();
  const historyId = React.useId();
  const feltRef = React.useRef<HTMLElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const bowlRef = React.useRef<HTMLDivElement>(null);
  const domeRef = React.useRef<HTMLDivElement>(null);
  const dieRefs = React.useRef<Array<HTMLSpanElement | null>>([]);
  const shadowRefs = React.useRef<Array<HTMLSpanElement | null>>([]);
  const paidRef = React.useRef<HTMLSpanElement>(null);
  const frameRef = React.useRef(0);
  const motionRef = React.useRef<RollMotion | null>(null);
  const playedRef = React.useRef<SicBoOutcome | null>(null);
  const sound = useTableSound();
  const soundEngine = sound.engine;

  /** The dice whose true areas light, and whether your area won the bet. */
  const [hit, setHit] = React.useState<{ dice: Dice; won: boolean } | null>(null);
  const [round, setRound] = React.useState<{ k: number; n: number } | null>(null);
  const [falling, setFalling] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [paid, setPaid] = React.useState<Celebration | null>(null);
  const [history, setHistory] = React.useState<Array<Roll & { id: number }>>([]);
  const nextId = React.useRef(0);
  const record = React.useCallback((rolls: readonly Roll[]) => {
    setHistory((list) =>
      [...rolls.map((roll) => ({ ...roll, id: nextId.current++ })).reverse(), ...list].slice(
        0,
        HISTORY
      )
    );
  }, []);

  const draw = React.useCallback(() => {
    const motion = motionRef.current;
    if (!motion) return;
    motion.dice.forEach((die, k) => {
      const el = dieRefs.current[k];
      const shadow = shadowRefs.current[k];
      if (!el || !shadow) return;
      // Lengths are in die widths, and a percentage translate is one of the die's own widths.
      el.style.transform = `translate(${(die.x * 100).toFixed(2)}%, ${(die.y * 100).toFixed(2)}%) scale(${(1 + die.lift * 0.22).toFixed(3)}) rotateZ(${die.rz.toFixed(1)}deg) rotateX(${die.rx.toFixed(1)}deg) rotateY(${die.ry.toFixed(1)}deg)`;
      shadow.style.transform = `translate(${((die.x + 0.075 + die.lift * 0.2) * 100).toFixed(2)}%, ${((die.y + 0.125 + die.lift * 0.25) * 100).toFixed(2)}%) scale(${(0.95 - die.lift * 0.15).toFixed(3)})`;
      shadow.style.opacity = (0.85 - die.lift * 0.35).toFixed(3);
    });
    const { x, y, rot } = motion.bowl;
    if (bowlRef.current)
      bowlRef.current.style.transform =
        x || y || rot
          ? `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${rot.toFixed(2)}deg)`
          : "";
    domeRef.current?.toggleAttribute("data-open", motion.open);
  }, []);

  // One frame loop, while the dice move.
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

  // The latest callbacks, for the motion's events.
  const latest = React.useRef({ onLanded, onRolling });
  latest.current = { onLanded, onRolling };

  /** Clear the lit areas and the paid chips. */
  const clear = React.useCallback(() => {
    setHit(null);
    setRound(null);
    setFalling(false);
    setDone(false);
    setPaid(null);
  }, []);

  // The last roll lights every area it makes true; your chip turns red only when your area won
  // that roll and the bet as a whole won, and the chips are paid on it.
  const settle = React.useCallback((current: SicBoOutcome) => {
    const win = celebrate(current);
    const last = current.rolls.at(-1);
    if (last) setHit({ dice: last.dice, won: Boolean(win) && last.won });
    setPaid(win);
  }, []);

  React.useEffect(() => {
    const motion = createRollMotion({
      // Wrapped: a browser's timer functions throw when called as another object's method.
      timers: {
        setTimeout: (run, ms) => setTimeout(run, ms),
        clearTimeout: (timer) => clearTimeout(timer)
      },
      reduced: reducedMotion(),
      events: {
        onRattle: () => soundEngine.current?.rattle(),
        onSettle: () => soundEngine.current?.settle(),
        onShake: (i) => {
          const n = playedRef.current?.rolls.length ?? 0;
          setHit(null);
          if (n > 1) setRound({ k: i + 1, n });
        },
        onRoll: (i) => {
          const roll = playedRef.current?.rolls[i];
          if (!roll) return;
          setHit({ dice: roll.dice, won: false });
          setRound(null);
          record([{ dice: roll.dice, won: roll.won }]);
        },
        onDone: () => {
          const current = playedRef.current;
          setRound(null);
          setFalling(false);
          setDone(true);
          if (current) settle(current);
          // Drawn here too: at the deadline the dice are laid out with no frame to follow.
          draw();
          latest.current.onLanded();
        }
      }
    });
    motionRef.current = motion;
    draw();
    // A hidden tab gets no frames: the rest of the roll is laid out at once.
    const onVisibility = () => {
      if (document.hidden) motion.flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(frameRef.current);
      motion.dispose();
      motionRef.current = null;
    };
  }, [draw, record, settle, soundEngine]);

  // Waiting for the random number: the dome goes down and is shaken. It lifts again for a refund,
  // and keeps shaking when the number arrives; the dice come down from there.
  const waiting = awaitsNumber(phase) && !outcome;
  const hasOutcome = Boolean(outcome);
  React.useEffect(() => {
    const motion = motionRef.current;
    if (!motion || !waiting) {
      if (motion && !motion.open && !hasOutcome && !playedRef.current) {
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
    // On a phone the table goes to the top of the screen, so the dish sits above the docked
    // slip; elsewhere it comes into view.
    const felt = feltRef.current;
    const stage = stageRef.current;
    const slip = document.querySelector("[data-slip]");
    const docked = slip ? getComputedStyle(slip).position === "fixed" : false;
    if (felt && stage) {
      const top = felt.getBoundingClientRect().top;
      const off = docked
        ? Math.abs(top) > 2
        : top < 0 || stage.getBoundingClientRect().bottom > window.innerHeight;
      if (off)
        felt.scrollIntoView?.({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
    }
  }, [clear, draw, hasOutcome, loop, waiting]);

  // The number is in: bring the dice down on each roll's faces. A result shown before this table
  // mounted is laid out as it came.
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
    const rolls = rollsOf(outcome);
    clear();
    if (rolls.length === 0) return;
    const bet = { kind: outcome.betKind, value: outcome.betValue };
    if (!sameArea(bet, area)) onAreaChange(bet);
    const dice = rolls.map((roll) => roll.dice);
    if (revealing || motion.shaking) {
      latest.current.onRolling();
      setFalling(true);
      if (rolls.length > 1) setRound({ k: 1, n: rolls.length });
      motion.play(dice);
      loop();
    } else {
      motion.place(dice);
      record(rolls);
      setDone(true);
      settle(outcome);
      draw();
    }
    // `revealing` and the area are read once per outcome.
  }, [clear, draw, loop, outcome, record, settle]);

  // Changing the area after a result clears the layout for the next bet; the dice stay as they lay.
  const choose = (next: Area) => {
    if (sameArea(next, area)) return;
    if (done || hit) clear();
    onAreaChange(next);
  };

  const rolls = outcome ? rollsOf(outcome) : [];
  const bet = outcome ? { kind: outcome.betKind, value: outcome.betValue } : area;
  const status: React.ReactNode = waiting ? (
    t("table.status.waiting")
  ) : done && rolls.length > 0 ? (
    copy.rolledPrint(rolls, bet)
  ) : hit ? (
    <>
      {copy.dicePrint(hit.dice)}
      {t("table.total", { total: diceTotal(hit.dice) })}
    </>
  ) : round ? (
    t("table.roll", { k: round.k, n: round.n })
  ) : falling ? (
    t("table.status.falling")
  ) : locked ? (
    ""
  ) : (
    t("table.status.ready")
  );

  const net = paid
    ? splitAmount(paid.net, decimals, Math.max(2, fractionDigits(paid.net, decimals)))
    : null;
  const pays = (target: Area, dice = 1) =>
    houseEdgeBps != null ? areaMultiplier(target, houseEdgeBps, dice) : null;
  const paysText = (target: Area, dice = 1) => {
    const value = pays(target, dice);
    return value ? multiplierText(value) : "–";
  };
  const chance = areaChance(area);
  const [chanceWhole, chanceFraction] = chance.split(".");
  const yourPays = pays(area);
  const figure =
    "font-print text-[26px] leading-none font-extrabold whitespace-nowrap text-print @max-[460px]/felt:text-[20px]";
  const figLabel = "text-note leading-tight text-print-soft @max-[460px]/felt:text-[12px]";

  const areaLabel = (target: Area) =>
    target.kind === "singleFace"
      ? t("table.singleLabel", {
          area: copy.area(target),
          m: paysText(target),
          chance: areaChance(target)
        })
      : t("table.areaLabel", {
          area: copy.area(target),
          m: paysText(target),
          chance: areaChance(target)
        });

  const cell = (target: Area) => {
    const chosen = sameArea(target, area);
    const lit = hit != null && factorOf(target, hit.dice) > 0;
    const { kind, value } = target;
    return (
      <button
        key={areaKey(target)}
        type="button"
        className="table-area"
        aria-pressed={chosen}
        aria-label={areaLabel(target)}
        disabled={locked}
        data-kind={kind}
        data-value={value}
        data-hit={lit || undefined}
        data-won={(chosen && lit && hit?.won) || undefined}
        onClick={() => choose(target)}
      >
        {kind === "small" || kind === "big" || kind === "anyTriple" ? (
          <>
            <span data-name>{copy.area(target)}</span>
            <span data-sub>{t(`table.range.${kind}`)}</span>
          </>
        ) : kind === "specificDouble" || kind === "specificTriple" ? (
          <span data-dd>
            {Array.from({ length: kind === "specificDouble" ? 2 : 3 }, (_, k) => (
              <MiniDie key={k} n={value} />
            ))}
          </span>
        ) : kind === "total" ? (
          <span data-tn>{value}</span>
        ) : (
          <MiniDie n={value} />
        )}
        <span data-p>{paysText(target)}×</span>
        <span data-chip aria-hidden="true">
          {chosen ? <span ref={paidRef} data-pay /> : null}
        </span>
      </button>
    );
  };

  return (
    <section
      ref={feltRef}
      aria-labelledby={titleId}
      className="table-felt @container/felt relative isolate overflow-hidden px-8 pt-6 pb-4 max-[720px]:px-3 max-[720px]:pt-[18px]"
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

      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-[26px] gap-y-3.5 @max-[460px]/felt:gap-x-3.5 @max-[460px]/felt:gap-y-2.5">
        <div ref={stageRef} aria-hidden="true" className="table-dish">
          <div ref={bowlRef} data-c="bowl">
            <div data-c="dish" />
            <div data-c="dice">
              {[0, 1, 2].map((k) => (
                <React.Fragment key={k}>
                  <span
                    ref={(el) => {
                      shadowRefs.current[k] = el;
                    }}
                    data-c="shadow"
                  />
                  <DieCube
                    ref={(el) => {
                      dieRefs.current[k] = el;
                    }}
                  />
                </React.Fragment>
              ))}
            </div>
            <div ref={domeRef} data-c="dome" data-open="" />
          </div>
        </div>

        <div className="grid min-w-0 gap-2.5 @max-[460px]/felt:gap-2">
          <div className="flex flex-wrap gap-x-[22px] gap-y-2 @max-[460px]/felt:grid @max-[460px]/felt:gap-1">
            <p className="grid gap-2 @max-[460px]/felt:gap-0.5">
              <span className={figLabel}>{t("table.yourBet")}</span>
              <span className="text-[22px] leading-[1.15] font-extrabold text-print @max-[460px]/felt:text-[17px]">
                {copy.area(area)}
              </span>
            </p>
            <p className="grid gap-2 @max-[460px]/felt:gap-0.5">
              <span className={figLabel}>{t("table.chance")}</span>
              <span className={figure}>
                <PrintedFigure
                  value={{ whole: chanceWhole!, fraction: chanceFraction ?? "", sign: "" }}
                  suffix="%"
                />
              </span>
            </p>
            <p className="grid gap-2 @max-[460px]/felt:gap-0.5">
              <span className={figLabel}>{t("table.pays")}</span>
              <span className={figure}>
                {yourPays ? (
                  area.kind === "singleFace" ? (
                    t("table.eachDie", { m: multiplierText(yourPays) })
                  ) : (
                    <PrintedFigure value={yourPays} suffix="×" />
                  )
                ) : (
                  "–"
                )}
              </span>
            </p>
          </div>
          {net && paid ? (
            <p
              aria-hidden="true"
              data-big={paid.big || undefined}
              className={`table-pay-glow text-[32px] leading-none whitespace-nowrap text-print @max-[620px]/felt:text-[28px] @max-[460px]/felt:hidden ${
                paid.big ? "motion-safe:animate-pay-pulse" : "motion-safe:animate-pay-in"
              }`}
            >
              <PrintedFigure value={{ ...net, sign: "+" }} />
              <small className="ml-1.5 font-text text-note font-semibold">{symbol}</small>
            </p>
          ) : null}
          <p
            aria-hidden="true"
            className="min-h-[2.8em] max-w-[24em] text-note leading-normal text-print-soft @max-[460px]/felt:hidden"
          >
            {status}
          </p>
          <div className="flex min-w-0 items-center gap-2.5 @max-[460px]/felt:flex-wrap @max-[460px]/felt:gap-1.5">
            <SoundButton
              sound={sound}
              compact="w-8 flex-none justify-center px-0! [&_[data-label]]:sr-only @max-[460px]/felt:size-[30px]"
            />
            <div className="min-w-0">
              <p id={historyId} className="sr-only">
                {t("table.history")}
              </p>
              <ol aria-labelledby={historyId} className="table-dice-history">
                {history.length === 0 ? (
                  <li data-none>{t("table.noHistory")}</li>
                ) : (
                  history.map((item) => (
                    <li key={item.id} data-paid={item.won || undefined}>
                      <span className="sr-only">
                        {t(item.won ? "table.tilePaid" : "table.tile", {
                          dice: copy.diceText(item.dice)
                        })}
                      </span>
                      {item.dice.map((n, k) => (
                        <MiniDie key={k} n={n} />
                      ))}
                    </li>
                  ))
                )}
              </ol>
            </div>
          </div>
        </div>
      </div>

      <div role="group" aria-labelledby={layoutId} className="table-layout">
        <span id={layoutId} className="sr-only">
          {t("table.layout")}
        </span>
        {ROWS.map((row) => (
          <div key={row.id} data-row={row.id}>
            {row.areas.map(cell)}
          </div>
        ))}
      </div>

      <p className="mt-3 text-center text-note leading-snug text-print-soft max-[720px]:text-[12px]">
        {t("table.rule", {
          one: paysText({ kind: "singleFace", value: 1 }, 1),
          two: paysText({ kind: "singleFace", value: 1 }, 2),
          three: paysText({ kind: "singleFace", value: 1 }, 3),
          rate: houseEdgeRate
        })}
      </p>
      {paid ? (
        // The layout's areas are small: its chips are the size of your own.
        <div className="contents [--chip-size:26px] @max-[460px]/felt:[--chip-size:20px]">
          <PaidChips
            key={`${areaKey(area)}-${history.length}`}
            count={paid.chips}
            feltRef={feltRef}
            spotRef={paidRef}
            sound={soundEngine}
          />
        </div>
      ) : null}
    </section>
  );
}
