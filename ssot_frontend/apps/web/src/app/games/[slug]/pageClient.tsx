"use client";

import * as React from "react";

import { DiceParamsForm, CoinTossParamsForm, RouletteParamsForm, KenoParamsForm } from "@ssot/ui";
import { getGameEncoder } from "@ssot/ssot/encoding";

import { Placeholder } from "../../../components/Placeholder";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { GameBetPanel } from "../../../features/betting/ui/GameBetPanel";
import { parseBigIntFromInput, clampNumber } from "../../../features/betting/model/units";

type GameMeta = {
  gameId: `0x${string}`;
  slug: string;
  label: string;
  paramsEncoding?: string;
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

  const description = `SSOT Hub.placeBet for ${game.label} using canonical params encoding.`;

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
    <GameBetPanel
      release={release}
      game={{ gameId: game.gameId, slug: game.slug, label: game.label }}
      description={description}
      getEncodedParams={getEncodedParams}
    >
      {renderParamsForm()}
    </GameBetPanel>
  );
}
