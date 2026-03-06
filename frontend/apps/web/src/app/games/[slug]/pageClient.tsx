"use client";

import * as React from "react";
import Link from "next/link";

import { DiceParamsForm, CoinTossParamsForm, RouletteParamsForm, KenoParamsForm, PageHeader } from "@ssot/ui";
import { getGameEncoder } from "@ssot/ssot/encoding";

import { Placeholder } from "../../../components/Placeholder";
import { PageTransition } from "../../../components/PageTransition";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { GameBetPanel } from "../../../features/betting/ui/GameBetPanel";
import { parseBigIntFromInput, clampNumber } from "../../../features/betting/model/units";

type GameMeta = {
  gameId: `0x${string}`;
  slug: string;
  label: string;
  paramsEncoding?: string;
};

const GAME_ICONS: Record<string, string> = {
  dice: "🎲",
  "coin-toss": "🪙",
  roulette: "🎯",
  keno: "🔢",
};

const GAME_DESCRIPTIONS: Record<string, string> = {
  dice: "Roll the dice and bet over or under your chosen threshold. Provably fair with Chainlink VRF.",
  "coin-toss": "Flip a coin — heads or tails. Double your bet or lose it all. 50/50 odds, on-chain.",
  roulette: "Place your bets on the European roulette wheel. 37 numbers, fully on-chain.",
  keno: "Pick up to 10 numbers from 1-80. The more you match, the bigger the payout.",
};

function toGameMeta(raw: any): GameMeta {
  return {
    gameId: raw.gameId as `0x${string}`,
    slug: String(raw.slug),
    label: String(raw.label),
    paramsEncoding: raw.paramsEncoding ? String(raw.paramsEncoding) : undefined,
  };
}

export function GamePageClient({ slug }: { slug: string }) {
  const { release, readOnlyReason } = useRelease();

  if (!release) {
    return (
      <Placeholder
        title="Games"
        description={readOnlyReason ?? "No embedded release available for the connected chain."}
        specPath="docs/frontend/PAGE-SPECS/010-GAMES.md"
      />
    );
  }
  const game = React.useMemo(() => {
    const found = release.gamesMeta?.find((g) => g.slug === slug);
    return found ? toGameMeta(found) : null;
  }, [release, slug]);

  // Dice
  const [diceCap, setDiceCap] = React.useState<string>("50");
  // Coin toss
  const [coinSide, setCoinSide] = React.useState<"heads" | "tails">("heads");
  // Roulette
  const [rouletteMask, setRouletteMask] = React.useState<string>("0x12345");
  // Keno
  const [kenoMask, setKenoMask] = React.useState<string>("0xabcde");

  // Reset per game when slug changes to keep UX predictable.
  React.useEffect(() => {
    setDiceCap("50");
    setCoinSide("heads");
    setRouletteMask("0x12345");
    setKenoMask("0xabcde");
  }, [slug]);

  if (!game) {
    return (
      <Placeholder
        title="Unknown game"
        description={`No game with slug '${slug}' found in release bundle gamesMeta. Sync the latest release bundle and retry.`}
        specPath="docs/frontend/PAGE-SPECS/010-GAMES.md"
      />
    );
  }

  const icon = GAME_ICONS[game.slug] ?? "🎮";
  const description = GAME_DESCRIPTIONS[game.slug] ?? `Place a bet on ${game.label}.`;

  const renderParamsForm = () => {
    switch (game.slug) {
      case "dice":
        return <DiceParamsForm cap={diceCap} onCapChange={setDiceCap} />;
      case "coin-toss":
        return <CoinTossParamsForm side={coinSide} onSideChange={setCoinSide} />;
      case "roulette":
        return <RouletteParamsForm mask={rouletteMask} onMaskChange={setRouletteMask} />;
      case "keno":
        return <KenoParamsForm mask={kenoMask} onMaskChange={setKenoMask} />;
      default:
        return (
          <Placeholder
            title={game.label}
            description={`No params UI implemented for slug '${game.slug}'.`}
            specPath="docs/frontend/PAGE-SPECS/010-GAMES.md"
          />
        );
    }
  };

  /** Build typed params from React state, then delegate to the registry encoder. */
  const getEncodedParams = () => {
    const encoder = getGameEncoder(game.slug);
    if (!encoder) throw new Error(`No encoder registered for slug: ${game.slug}`);

    // Map React UI state → typed encoder params
    switch (game.slug) {
      case "dice": {
        const capN = clampNumber(Number(diceCap), 0, 255);
        if (!Number.isFinite(capN) || !Number.isInteger(capN)) throw new Error("Dice cap must be an integer");
        return encoder.encode({ cap: capN });
      }
      case "coin-toss":
        return encoder.encode({ face: coinSide === "heads" });
      case "roulette":
        return encoder.encode({ mask: parseBigIntFromInput(rouletteMask) });
      case "keno":
        return encoder.encode({ mask: parseBigIntFromInput(kenoMask) });
      default:
        throw new Error(`Unsupported game slug: ${game.slug}`);
    }
  };

  return (
    <PageTransition pageKey={`game-${slug}`}>
      {/* Game Room Header */}
      <PageHeader
        title={`${icon} ${game.label}`}
        description={description}
        actions={
          <Link
            href="/games"
            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Games
          </Link>
        }
      />

      {/* Game Room: Params Form + Bet Panel */}
      <GameBetPanel
        release={release}
        game={{ gameId: game.gameId, slug: game.slug, label: game.label }}
        description={`On-chain bet via Hub.placeBet for ${game.label}`}
        getEncodedParams={getEncodedParams}
      >
        {renderParamsForm()}
      </GameBetPanel>
    </PageTransition>
  );
}
