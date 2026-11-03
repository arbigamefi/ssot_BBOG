"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";

import { getCasinoAccess } from "../../../app-shell/casino-access";
import { getAppChain } from "../../../app-shell/chain-registry";
import { TESTNET_USDC_FAUCET } from "../../../config/site";
import { getDefaultCasinoPoolAssetContext } from "../../../features/assets/pool-asset";
import { GameStubList, useGameStubs, type GameStub } from "../../../features/casino/game-stubs";
import { useCasinoStats } from "../../../features/casino/useCasinoStats";
import { formatWinChance, winChanceRange } from "../../../features/casino/win-chances";
import { TelegramDock, TelegramFollow } from "../../../features/home/home-sections";
import { PrintedFigure } from "../../../features/home/printed-figure";
import { splitAmount, type SignedAmount } from "../../../features/home/receipts";
import { useRelease } from "../../../ssot/release/ReleaseProvider";

const SECTION_GRID =
  "mx-auto box-content grid max-w-page grid-cols-1 gap-x-columns px-gutter lg:grid-cols-12";
const FOCUS_ON_CARBON =
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-paper";
const OUTLINE_ON_CARBON = `inline-grid min-h-12 place-items-center rounded-sheet border border-current px-5 font-semibold whitespace-nowrap text-paper hover:bg-paper hover:text-ink ${FOCUS_ON_CARBON}`;

/**
 * The casino lobby in Carbon copy: the site state on carbon, then one ticket stub per game the
 * release ships and GameHub has not disabled, each with its win chance and what one bet can return.
 */
export function CasinoLobbyClient() {
  const t = useTranslations("casino.lobby");
  const names = useTranslations("casino.room.names");
  const locale = useLocale();
  const { chainId, release } = useRelease();
  const access = getCasinoAccess(chainId);
  const chainName = getAppChain(chainId)?.name ?? String(chainId);
  const houseEdgeBps = release?.defaultHouseEdgeBps ?? 0;
  const houseEdgeRate = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 2
  }).format(houseEdgeBps / 10_000);
  const stubs = useGameStubs(release?.gamesMeta, houseEdgeBps);
  const maxRounds = release?.gamesMeta.reduce((max, game) => Math.max(max, game.maxBetCount), 0);

  const chance = (stub: GameStub) => {
    const [low, high] = winChanceRange(stub.slug);
    const from = formatWinChance(low, locale);
    const to = formatWinChance(high, locale);
    return from === to ? from : t("games.range", { from, to });
  };

  return (
    <div className="bg-paper font-text text-body text-carbon">
      <header className="bg-carbon text-paper">
        <div className={`${SECTION_GRID} pt-16 pb-section md:pt-24`}>
          <div className="lg:col-span-7">
            <h1 className="text-display font-extrabold text-balance break-keep">{t("title")}</h1>
            <p className="mt-6 max-w-[34em] text-lede text-on-carbon-muted">
              {release ? t("lede") : t("noRelease")}
            </p>
          </div>
          {release && access !== "live" ? (
            <div className="pt-8 lg:col-span-7 lg:pt-12">
              {access === "preview" ? (
                <TelegramFollow note={t("preview.note")} />
              ) : (
                <div className="max-w-[520px]">
                  <p className="mb-4 text-on-carbon-muted">
                    {t("testnet.note", { chain: chainName })}
                  </p>
                  <a
                    href={TESTNET_USDC_FAUCET}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={OUTLINE_ON_CARBON}
                  >
                    {t("testnet.faucet")}
                  </a>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </header>
      {release ? (
        <section aria-labelledby="casino-games-title" className="bg-paper py-section text-carbon">
          <div className={SECTION_GRID}>
            <div className="mb-head lg:col-span-7">
              <h2
                id="casino-games-title"
                className="text-heading font-extrabold text-balance break-keep"
              >
                {t("games.title")}
              </h2>
              <p className="mt-4 max-w-[34em] text-lede text-faded">
                {t("games.lede", { rate: houseEdgeRate })}
              </p>
            </div>
            {stubs.length ? (
              <GameStubList
                stubs={stubs}
                title={(stub) => names(stub.key)}
                detail={(stub) => t(`games.items.${stub.key}`, { chance: chance(stub) })}
                pays={t("games.pays")}
                upTo={t("games.upTo")}
              />
            ) : (
              <p role="status" className="text-faded lg:col-span-8">
                {t("games.empty")}
              </p>
            )}
            {maxRounds ? (
              <p className="mt-6 text-note text-faded lg:col-span-8">
                {t("games.note", { rounds: maxRounds })}
              </p>
            ) : null}
            <LobbyStats release={release} />
          </div>
        </section>
      ) : null}
      {access === "preview" && release ? <TelegramDock /> : null}
    </div>
  );
}

/** What the bet index has counted so far. Hidden until it has counted a bet. */
function LobbyStats({
  release
}: {
  release: NonNullable<ReturnType<typeof useRelease>["release"]>;
}) {
  const t = useTranslations("casino.lobby.stats");
  const asset = React.useMemo(() => getDefaultCasinoPoolAssetContext(release)?.asset, [release]);
  const { data } = useCasinoStats({ asset: asset?.address });
  if (data?.source !== "postgres" || data.stats.betCount === 0) return null;

  const count = (value: number): SignedAmount => ({
    sign: "",
    whole: value.toLocaleString("en-US"),
    fraction: ""
  });
  const turnover = {
    ...splitAmount(BigInt(data.stats.turnover), data.asset.decimals, 2),
    sign: "" as const
  };
  const rows = [
    { key: "bets", value: count(data.stats.betCount) },
    { key: "players", value: count(data.stats.uniquePlayers) },
    { key: "turnover", value: turnover, symbol: data.asset.symbol }
  ] as const;
  return (
    <dl
      aria-label={t("label")}
      className="mt-12 grid grid-cols-1 gap-x-columns gap-y-6 border-t border-thermal pt-6 sm:grid-cols-3 lg:col-span-12"
    >
      {rows.map((row) => (
        <div key={row.key}>
          <dt className="text-note text-faded">{t(row.key)}</dt>
          <dd className="mt-2 text-price">
            <PrintedFigure value={row.value} />
            {"symbol" in row ? (
              <small className="ml-2 text-note font-semibold">{row.symbol}</small>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
