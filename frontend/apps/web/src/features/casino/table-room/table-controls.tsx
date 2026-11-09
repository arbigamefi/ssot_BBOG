"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { TableSound } from "./table-sound";

const SOUND_KEY = "agf-table-sound";

/** True under reduced motion, and before the page can tell. */
export const reducedMotion = () =>
  typeof window === "undefined" ||
  (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true);

/**
 * Chips slide from the house's side of the felt onto the bet that won, centred on it, and stay
 * there. Dice pays from the top centre; roulette from the top right, where the wheel is not.
 */
export function PaidChips({
  count,
  feltRef,
  spotRef,
  sound,
  from = "centre"
}: {
  count: number;
  feltRef: React.RefObject<HTMLElement | null>;
  spotRef: React.RefObject<HTMLElement | null>;
  sound: React.RefObject<TableSound | null>;
  from?: "centre" | "end";
}) {
  const layerRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const layer = layerRef.current;
    const felt = feltRef.current;
    if (!layer || !felt) return;
    const chips = Array.from(layer.children) as HTMLElement[];
    const place = () => {
      const spot = spotRef.current?.getBoundingClientRect();
      const box = felt.getBoundingClientRect();
      if (!spot) return null;
      const size = chips[0]?.offsetWidth || spot.width;
      const x = spot.left - (box.left + felt.clientLeft) + spot.width / 2 - size / 2;
      const y = spot.top - (box.top + felt.clientTop) + spot.height / 2 - size / 2;
      chips.forEach((chip, k) => {
        chip.style.transform = `translate(${x + (k % 2 ? 1 : -1)}px, ${y - 4 * (k + 1)}px)`;
      });
      return size;
    };
    const size = place();
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    if (size != null && !reducedMotion()) {
      const fromX = from === "end" ? felt.clientWidth - size - 24 : felt.clientWidth / 2 - size / 2;
      chips.forEach((chip, k) => {
        const spread = (k - (count - 1) / 2) * 14;
        chip.animate?.(
          [
            { transform: `translate(${fromX + spread}px, ${-size - 8}px)` },
            { transform: chip.style.transform }
          ],
          {
            duration: 560,
            delay: 120 + k * 110,
            easing: "cubic-bezier(.2, .8, .3, 1)",
            fill: "backwards"
          }
        );
        timers.push(setTimeout(() => sound.current?.clink(k), 120 + k * 110 + 540));
      });
    } else {
      sound.current?.clink(0);
    }
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      timers.forEach(clearTimeout);
    };
    // The chips are paid once.
  }, []);

  return (
    <div ref={layerRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-5">
      {Array.from({ length: count }, (_, k) => (
        <i key={k} className="table-chip absolute top-0 left-0" />
      ))}
    </div>
  );
}

export type SoundSwitch = {
  engine: React.RefObject<TableSound | null>;
  on: boolean;
  toggle: () => void;
};

/**
 * The table's sound: off until the player turns it on, remembered on this device. The synthesiser
 * is loaded only once sound is on.
 */
export function useTableSound(): SoundSwitch {
  const engine = React.useRef<TableSound | null>(null);
  const [on, setOn] = React.useState(false);

  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(SOUND_KEY) === "on") setOn(true);
    } catch {
      // Storage may be blocked; sound stays off.
    }
  }, []);

  React.useEffect(() => {
    if (!on) return;
    let cancelled = false;
    void import("./table-sound").then(({ createTableSound }) => {
      if (!cancelled) engine.current = createTableSound();
    });
    return () => {
      cancelled = true;
      engine.current?.close();
      engine.current = null;
    };
  }, [on]);

  const toggle = React.useCallback(() => {
    setOn((current) => {
      try {
        window.localStorage.setItem(SOUND_KEY, current ? "off" : "on");
      } catch {
        // The choice lasts for this visit only.
      }
      return !current;
    });
  }, []);

  return React.useMemo(() => ({ engine, on, toggle }), [on, toggle]);
}

function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M2 6h2.5L8 3v10L4.5 10H2z" fill="currentColor" />
      {on ? (
        <path d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6.3 6.3 0 0 1 0 9" />
      ) : (
        <path d="M11 6l4 4M15 6l-4 4" />
      )}
    </svg>
  );
}

/** The sound switch on the felt: off until pressed, remembered on this device. */
export function SoundButton({ sound, compact }: { sound: SoundSwitch; compact?: string }) {
  const t = useTranslations("casino.table.sound");
  const label = sound.on ? t("on") : t("off");
  return (
    <button
      type="button"
      aria-pressed={sound.on}
      aria-label={label}
      onClick={sound.toggle}
      className={`inline-flex h-8 items-center gap-2 rounded-full border pr-3 pl-2.5 text-note focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper ${
        sound.on ? "border-print-soft text-print" : "border-print-faint text-print-soft"
      } ${compact ?? ""}`}
    >
      <SoundIcon on={sound.on} />
      <span data-label="">{label}</span>
    </button>
  );
}
