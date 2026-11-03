"use client";

import * as React from "react";

import type { SignedAmount } from "../home/receipts";
import { getCatalogRooms } from "./catalog";
import { ticketMultiplier } from "./game-multipliers";
import { isCasinoModuleSlug, type CasinoModuleSlug } from "./modules";
import { TicketStub } from "./ticket-stub";
import { useDisabledGameIds, withoutDisabledRooms } from "./useDisabledGames";

export type GameStub = {
  slug: CasinoModuleSlug;
  /** The game's i18n key, such as `coinToss`. */
  key: string;
  href: string;
  multiplier: SignedAmount;
  fixed: boolean;
};

/** i18n key of a game, from its module slug. */
export function gameKey(slug: string) {
  return slug.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * One stub per game the release ships and GameHub has not disabled, in catalog order, each with
 * its top multiplier after the release's house edge.
 */
export function useGameStubs(
  gamesMeta: Array<{ slug: string; label: string; gameId: string }> | undefined,
  houseEdgeBps: number
): GameStub[] {
  const disabledGameIds = useDisabledGameIds();
  return React.useMemo(
    () =>
      withoutDisabledRooms(getCatalogRooms(gamesMeta), gamesMeta, disabledGameIds).flatMap(
        (room) => {
          if (!isCasinoModuleSlug(room.slug)) return [];
          const { value, fixed } = ticketMultiplier(room.slug, houseEdgeBps);
          return [
            { slug: room.slug, key: gameKey(room.slug), href: room.href, multiplier: value, fixed }
          ];
        }
      ),
    [disabledGameIds, gamesMeta, houseEdgeBps]
  );
}

/** Game stubs on paper, two to a row on wide screens. */
export function GameStubList({
  stubs,
  title,
  detail,
  pays,
  upTo
}: {
  stubs: readonly GameStub[];
  title: (stub: GameStub) => string;
  detail: (stub: GameStub) => React.ReactNode;
  pays: string;
  upTo: string;
}) {
  return (
    <ul className="grid grid-cols-1 gap-columns lg:col-span-12 lg:grid-cols-2">
      {stubs.map((stub) => (
        <li key={stub.slug} data-slug={stub.slug}>
          <TicketStub
            href={stub.href}
            title={title(stub)}
            detail={detail(stub)}
            label={stub.fixed ? pays : upTo}
            value={stub.multiplier}
            suffix="×"
          />
        </li>
      ))}
    </ul>
  );
}
