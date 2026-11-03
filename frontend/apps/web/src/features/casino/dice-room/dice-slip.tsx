"use client";

import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import type { CasinoAccess } from "../../../app-shell/casino-access";
import { requestWalletConnect } from "../../../app-shell/wallet-connect-events";
import { OFFICIAL_CHANNELS, TESTNET_ETH_FAUCET, TESTNET_USDC_FAUCET } from "../../../config/site";
import { betAmountInputToRaw, normalizeBetAmountInput } from "../room/bet-amount";
import { casinoVrfFeeBudget, formatNativeFee, toUnixMs } from "../room/casino-round";
import { getBetErrorKind } from "../room/feedback";
import { isCasinoTerminalRoundResult } from "../room/resolution";
import type { GameRoom } from "../room/use-game-room";
import { DiceReceipt } from "./dice-receipt";
import {
  deriveSlipQuote,
  dicePayout,
  diceWinRange,
  diceWins,
  formatQuote,
  formatStake,
  quoteRaw,
  slipMaxStake,
  stakeText,
  type SlipAction,
  type SlipNotice
} from "./slip-model";
import { DIVIDER, LINE_BUTTON, LINK, MAIN_BUTTON } from "./styles";

/** The slip's paper. A finished receipt is torn off along its lower edge. */
const SHEET =
  "print-sheet relative scroll-mt-4 rounded-sheet px-5 pt-6 pb-5 md:px-7 md:pt-8 md:pb-7";

/**
 * The bet slip is the quote. Once the bet is placed the same paper prints the receipt, and once
 * it settles the receipt is torn off. The main button keeps one place in every state.
 */
export function DiceSlip({
  room,
  access,
  chainName,
  houseEdgeRate
}: {
  room: GameRoom;
  access: CasinoAccess;
  chainName: string;
  houseEdgeRate: string;
}) {
  const t = useTranslations("casino.dice");
  const { casinoRound } = room;
  const status = casinoRound.state.status;
  const signing = status === "planning" || status === "submitting";
  const result =
    room.showResult && isCasinoTerminalRoundResult(room.resultProof) ? room.resultProof : null;
  const printing = !result && !signing && room.isBetPanelPending;
  const phase = room.placeBetButtonPhase;
  const [receiptNews, setReceiptNews] = React.useState("");

  // One polite line per change a screen reader user cannot see.
  const announcement = result
    ? receiptNews
    : signing
      ? t("announce.signing")
      : printing && phase === "waiting_vrf"
        ? t("announce.placed")
        : printing && phase === "refundable"
          ? t("announce.refundable")
          : "";

  return (
    <>
      {result ? (
        <DiceReceipt
          room={room}
          result={result}
          chainName={chainName}
          houseEdgeRate={houseEdgeRate}
          onAnnounce={setReceiptNews}
        />
      ) : printing ? (
        <PrintingSlip room={room} />
      ) : (
        <QuoteSlip room={room} access={access} chainName={chainName} />
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}

/** "Dice, win on 1–50". */
function useGameLine(room: GameRoom) {
  const t = useTranslations("casino.dice.slip");
  const [from, to] = diceWinRange(room.diceDirection, room.diceTarget);
  return t("game", { from, to });
}

function SlipHeader({ right }: { right: string }) {
  return (
    <header className="flex items-baseline justify-between gap-3 text-note text-faded">
      <b className="font-semibold text-ink">ArbiGameFi</b>
      <span>{right}</span>
    </header>
  );
}

function QuoteLine({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline gap-2 py-1">
      <span>{label}</span>
      <span aria-hidden="true" className="print-leader" />
      <span className="font-semibold">{value}</span>
    </li>
  );
}

function QuoteSlip({
  room,
  access,
  chainName
}: {
  room: GameRoom;
  access: CasinoAccess;
  chainName: string;
}) {
  const t = useTranslations("casino.dice");
  const gameLine = useGameLine(room);
  const slipRef = React.useRef<HTMLElement>(null);
  const actRef = React.useRef<HTMLDivElement>(null);
  const { casinoRound, assetDecimals: decimals, assetSymbol: symbol } = room;
  const { state } = casinoRound;
  const status = state.status;
  const signing = status === "planning" || status === "submitting";
  const maxRounds = Math.max(1, casinoRound.maxBetCount ?? 1);
  const rounds = room.betCount;
  const perRound = betAmountInputToRaw(room.betAmount, decimals);
  const total = perRound * BigInt(Math.max(1, rounds));
  const wins = diceWins(room.diceDirection, room.diceTarget);
  const bps = room.houseEdgeBps;
  const winPays = bps == null || perRound === 0n ? undefined : dicePayout(perRound, wins, bps);
  const fee = casinoVrfFeeBudget(casinoRound.vrfQuote);
  const feeText = fee == null ? "—" : formatNativeFee(fee, "ETH", "up");
  const minPerRound = room.poolSnapshot?.minBetAmount ?? 0n;
  const poolMaxPerRound = bps == null ? undefined : room.limits.maxBetRaw;
  const balance = room.walletBalance?.raw;
  const hasAccount = Boolean(room.sdk?.account);

  const quote = deriveSlipQuote({
    access,
    hasAccount,
    wrongNetwork: Boolean(room.wrongNetwork),
    status,
    executionStage: state.executionStage,
    needsApproval: state.plan?.preview?.needsApproval,
    errorKind: state.error ? getBetErrorKind(state.error) : undefined,
    canCheckTransaction: Boolean(casinoRound.checkTransaction),
    poolAvailability: casinoRound.availability,
    perRound,
    rounds,
    minPerRound,
    poolMaxPerRound,
    balance,
    decimals
  });
  const minStake = quoteRaw(minPerRound, decimals, "up");
  const maxStake = slipMaxStake({ poolMaxPerRound, balance, rounds, decimals });
  const locked = signing || access === "preview";
  const amount = (raw: bigint) => formatQuote(raw, decimals);
  const setStake = (raw: bigint) => room.setBetAmount(stakeText(raw, decimals));
  const docked = useDockedAction(slipRef, actRef);

  const [roundsText, setRoundsText] = React.useState(String(rounds));
  React.useEffect(() => setRoundsText(String(rounds)), [rounds]);
  const changeRounds = (next: number) =>
    room.setBetCount(Math.min(maxRounds, Math.max(1, Math.floor(next))));

  const winLabel = rounds > 1 ? t("slip.eachWin") : t("slip.ifWin");
  const winText = winPays == null ? "—" : `${amount(winPays)} ${symbol}`;
  const bad = ["min", "overMax", "balance"].includes(quote.notice?.kind ?? "");

  const place = () => {
    // Placed from the docked bar: bring the slip up, since it prints the receipt.
    if (docked.docked) {
      const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;
      slipRef.current?.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
    }
    void casinoRound.placeBet();
  };

  return (
    <article ref={slipRef} aria-label={t("slip.label")} className={SHEET}>
      <SlipHeader right={t("slip.title")} />
      <p className="mt-4 text-lede font-semibold">{gameLine}</p>
      <hr className={DIVIDER} />
      <div className="hidden lg:block">
        <ul>
          {rounds > 1 ? (
            <>
              <QuoteLine label={winLabel} value={winText} />
              <QuoteLine
                label={t("slip.total")}
                value={perRound > 0n ? `${amount(total)} ${symbol}` : "—"}
              />
            </>
          ) : (
            <QuoteLine label={winLabel} value={winText} />
          )}
          <QuoteLine label={t("slip.fee")} value={t("slip.feeUpTo", { fee: feeText })} />
        </ul>
        <hr className={DIVIDER} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <label htmlFor="dice-rounds" className="font-semibold">
          {t("slip.rounds")}
        </label>
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            disabled={locked || rounds <= 1}
            aria-label={t("slip.fewer")}
            onClick={() => changeRounds(rounds - 1)}
            className={`${LINE_BUTTON} size-10 px-0 text-lede`}
          >
            −
          </button>
          <input
            id="dice-rounds"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            disabled={locked}
            value={roundsText}
            onChange={(event) => {
              const text = event.target.value.replace(/\D/g, "");
              setRoundsText(text);
              const next = Number(text);
              if (Number.isInteger(next) && next >= 1 && next <= maxRounds) room.setBetCount(next);
            }}
            onBlur={() => setRoundsText(String(rounds))}
            className="h-10 w-12 rounded-print border border-faded bg-transparent text-center font-semibold text-carbon tabular-nums focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ink disabled:text-faded"
          />
          <button
            type="button"
            disabled={locked || rounds >= maxRounds}
            aria-label={t("slip.more")}
            onClick={() => changeRounds(rounds + 1)}
            className={`${LINE_BUTTON} size-10 px-0 text-lede`}
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <label htmlFor="dice-stake" className="font-semibold">
          {rounds > 1 ? t("slip.stakePer") : t("slip.stake")}
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={locked}
            onClick={() =>
              setStake(clampStake(quoteRaw(perRound / 2n, decimals), minStake, maxStake))
            }
            className={LINE_BUTTON}
          >
            {t("slip.half")}
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() =>
              setStake(clampStake(quoteRaw(perRound * 2n, decimals), minStake, maxStake))
            }
            className={LINE_BUTTON}
          >
            {t("slip.double")}
          </button>
          <button
            type="button"
            disabled={locked || maxStake == null}
            onClick={() => maxStake != null && setStake(maxStake)}
            className={LINE_BUTTON}
          >
            {maxStake == null ? t("slip.maxUnknown") : t("slip.max", { amount: amount(maxStake) })}
          </button>
        </div>
      </div>

      <div
        ref={actRef}
        style={docked.style}
        className={`mt-4 max-lg:z-20 max-lg:-mx-5 max-lg:border-t max-lg:border-thermal max-lg:bg-paper max-lg:px-5 max-lg:pt-3 max-lg:pb-[calc(12px+env(safe-area-inset-bottom))] md:max-lg:-mx-7 md:max-lg:px-7 ${
          docked.docked ? "fixed bottom-0" : "max-lg:sticky max-lg:bottom-0"
        }`}
      >
        {quote.notice ? (
          <SlipNoticeText
            notice={quote.notice}
            room={room}
            chainName={chainName}
            wins={wins}
            maxRounds={maxRounds}
          />
        ) : null}
        <p className="mb-2 flex flex-wrap justify-between gap-x-3 text-note text-faded lg:hidden">
          <span className="whitespace-nowrap">
            {winLabel} <b className="font-semibold text-ink">{winText}</b>
          </span>
          <span className="whitespace-nowrap">{t("slip.feeShort", { fee: feeText })}</span>
        </p>
        <div
          className={`flex flex-wrap gap-1 rounded-sheet border-ink max-md:[&>*:last-child]:flex-[1_0_auto] ${
            bad ? "border-2 p-[3px]" : "border p-1"
          }`}
        >
          <span className="flex min-w-0 flex-[1000_1_112px] items-center md:flex-1">
            <input
              id="dice-stake"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              disabled={locked}
              value={room.betAmount}
              aria-invalid={bad || undefined}
              onChange={(event) =>
                room.setBetAmount(normalizeBetAmountInput(event.target.value, decimals))
              }
              className="h-14 min-w-0 flex-1 rounded-print bg-transparent pr-1 pl-3 text-lede font-semibold text-carbon tabular-nums focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ink disabled:text-faded md:pl-4"
            />
            <span className="pr-3 text-note text-faded">{symbol}</span>
          </span>
          <MainButton
            action={quote.action}
            room={room}
            chainName={chainName}
            perRoundTotal={total}
            hideSub={bad}
            onPlace={place}
            onSetStake={setStake}
          />
        </div>
      </div>

      {access === "preview" ? null : (
        <p className="mt-4 text-note text-faded">
          {hasAccount
            ? room.walletBalance
              ? t("slip.balance", { amount: amount(room.walletBalance.raw), symbol })
              : null
            : t("slip.connectHint")}
        </p>
      )}
    </article>
  );
}

function clampStake(value: bigint, min: bigint, max: bigint | undefined) {
  const low = value < min ? min : value;
  return max != null && low > max ? max : low;
}

function SlipNoticeText({
  notice,
  room,
  chainName,
  wins,
  maxRounds
}: {
  notice: SlipNotice;
  room: GameRoom;
  chainName: string;
  wins: number;
  maxRounds: number;
}) {
  const t = useTranslations("casino.dice.notice");
  const symbol = room.assetSymbol;
  const amount = (raw: bigint) => formatQuote(raw, room.assetDecimals);
  const [lead, body] = (() => {
    switch (notice.kind) {
      case "preview":
        return [t("preview.lead"), t("preview.body")];
      case "network":
        return [t("network.lead"), t("network.body", { chain: chainName })];
      case "pool":
        return [
          t(`pool.${notice.status}.lead`),
          t(`pool.${notice.status}.body`, { rounds: maxRounds })
        ];
      case "min":
        return [
          t("min.lead"),
          t("min.body", { amount: formatStake(notice.min, room.assetDecimals), symbol })
        ];
      case "overMax":
        return [
          t("overMax.lead"),
          room.betCount > 1
            ? t("overMax.bodyPerRound", {
                chance: wins,
                amount: formatStake(notice.max, room.assetDecimals),
                symbol
              })
            : t("overMax.body", {
                chance: wins,
                amount: formatStake(notice.max, room.assetDecimals),
                symbol
              })
        ];
      case "noCapacity":
        return [t("noCapacity.lead"), t("noCapacity.body")];
      case "balance":
        return [
          t("balance.lead", { symbol }),
          t("balance.body", { amount: amount(notice.balance), symbol, chain: chainName })
        ];
      case "error":
        return [
          t(`error.${notice.error}.lead`, { symbol }),
          t(`error.${notice.error}.body`, { symbol, chain: chainName })
        ];
    }
  })();
  return (
    <p role="status" className="mb-3 border-l-2 border-ink pl-4 text-note">
      <b className="font-semibold">{lead}</b> {body}
    </p>
  );
}

/** The main button, as the one action that moves the bet on. */
function MainButton({
  action,
  room,
  chainName,
  perRoundTotal,
  hideSub,
  onPlace,
  onSetStake
}: {
  action: SlipAction;
  room: GameRoom;
  chainName: string;
  perRoundTotal: bigint;
  hideSub: boolean;
  onPlace: () => void;
  onSetStake: (raw: bigint) => void;
}) {
  const t = useTranslations("casino.dice.action");
  const symbol = room.assetSymbol;
  const amount = (raw: bigint) => formatQuote(raw, room.assetDecimals);
  const { casinoRound } = room;
  const className = `${MAIN_BUTTON} md:min-w-44`;
  const content = (label: string, sub?: string) => (
    <>
      <b className="font-semibold">{label}</b>
      {sub && !hideSub ? <small className="text-note font-normal opacity-80">{sub}</small> : null}
    </>
  );
  const button = (label: string, onClick?: () => void, sub?: string) => (
    <button type="button" disabled={!onClick} onClick={onClick} className={className}>
      {content(label, sub)}
    </button>
  );
  const link = (label: string, href: string) => (
    <a href={href} target="_blank" rel="noreferrer noopener" className={className}>
      {content(label)}
    </a>
  );

  switch (action.kind) {
    case "telegram":
      return link(t("telegram"), OFFICIAL_CHANNELS.telegram);
    case "connect":
      return button(t("connect"), requestWalletConnect);
    case "switchNetwork":
      return button(t("switchNetwork", { chain: chainName }), room.switchNetwork);
    case "signing":
      return button(
        t(`signing.${action.step}.label`, { symbol }),
        undefined,
        t(`signing.${action.step}.sub`)
      );
    case "poolLoading":
      return button(t("poolLoading"));
    case "checkAgain":
      return button(t("checkAgain"), room.refreshPool);
    case "setStake":
      return button(
        action.why === "min"
          ? t("raise", { amount: formatStake(action.to, room.assetDecimals) })
          : t("lower", { amount: formatStake(action.to, room.assetDecimals) }),
        () => onSetStake(action.to),
        t(`setStakeSub.${action.why}`)
      );
    case "faucet":
      return action.asset === "usdc"
        ? link(t("faucetUsdc", { symbol }), TESTNET_USDC_FAUCET)
        : link(t("faucetEth"), TESTNET_ETH_FAUCET);
    case "blocked":
      return button(t(`blocked.${action.why}`, { symbol }));
    case "checkTransaction":
      return casinoRound.checkingTransaction
        ? button(t("checking"))
        : button(t("checkTransaction"), () => void casinoRound.checkTransaction?.());
    case "place":
      return action.approval
        ? button(t("approve", { symbol }), onPlace, t("approveSub"))
        : button(t("place"), onPlace, t("placeSub", { amount: amount(perRoundTotal), symbol }));
  }
}

/**
 * Below the two-column layout the slip's action rides along the bottom of the screen. Sticky
 * positioning does that once the top of the slip is on screen; until then the action is docked
 * to the bottom of the screen at the slip's width.
 */
function useDockedAction(
  slipRef: React.RefObject<HTMLElement | null>,
  actRef: React.RefObject<HTMLDivElement | null>
) {
  const [dock, setDock] = React.useState<{ left: number; width: number } | null>(null);
  React.useEffect(() => {
    const narrow = window.matchMedia?.("(max-width: 1023.98px)");
    if (!narrow) return;
    let frame = 0;
    const measure = () => {
      const slip = slipRef.current;
      const act = actRef.current;
      if (!slip || !act) return;
      const box = slip.getBoundingClientRect();
      const top = parseFloat(getComputedStyle(slip).paddingTop) || 0;
      // The action keeps its 16px top margin while it rides inside the slip.
      const docked = narrow.matches && box.top + top + 16 + act.offsetHeight > window.innerHeight;
      setDock((current) => {
        if (!docked) return null;
        if (current?.left === box.left && current.width === box.width) return current;
        return { left: box.left, width: box.width };
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Web fonts move the slip once they load.
    void document.fonts?.ready.then(schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [actRef, slipRef]);
  return {
    docked: dock != null,
    style: dock ? { left: dock.left, width: dock.width, margin: 0 } : undefined
  };
}

/** Placed and waiting: the paper is printing, so its edge is still plain. */
function PrintingSlip({ room }: { room: GameRoom }) {
  const t = useTranslations("casino.dice");
  const tReceipt = useTranslations("receipt");
  const locale = useLocale();
  const gameLine = useGameLine(room);
  const { casinoRound, assetSymbol: symbol, assetDecimals: decimals } = room;
  const bet = casinoRound.activeBet;
  const phase = room.placeBetButtonPhase;
  const now = useNow(phase === "waiting_vrf");
  const amount = (raw: bigint) => formatQuote(raw, decimals);
  const perRound = bet?.amountPerRoll ?? betAmountInputToRaw(room.betAmount, decimals);
  const stake = bet?.stake ?? perRound * BigInt(Math.max(1, room.betCount));
  const bps = bet?.houseEdgeBps ?? room.houseEdgeBps;
  const wins = diceWins(room.diceDirection, room.diceTarget);
  const winPays = bps == null ? undefined : dicePayout(perRound, wins, bps);
  const rounds = bet?.betCount ?? room.betCount;
  const placedMs = toUnixMs(bet?.placedAt);
  const seconds = placedMs ? Math.max(0, Math.floor((now - placedMs) / 1000)) : 0;
  const deadline = bet?.refundDeadline
    ? new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: "UTC"
      }).format(new Date(bet.refundDeadline * 1000))
    : "—";

  const { title, note, action } = (() => {
    switch (phase) {
      case "placing":
        return { title: t("print.placing.title"), note: t("print.placing.note") };
      case "waiting_vrf":
        return { title: t("print.waiting.title"), note: t("print.waiting.note", { seconds }) };
      case "timeout_soft":
        return { title: t("print.slow.title"), note: t("print.slow.note", { time: deadline }) };
      case "manual_settle_offered":
        return {
          title: t("print.settleOffered.title"),
          note: t("print.settleOffered.note"),
          action: casinoRound.manualSettleAvailable
            ? {
                label: t("print.settleOffered.button"),
                run: () => void casinoRound.manualSettle?.()
              }
            : undefined
        };
      case "refundable":
        return {
          title: t("print.refundable.title"),
          note: t("print.refundable.note", { amount: amount(stake), symbol }),
          action: casinoRound.manualRefundAvailable
            ? {
                label: t("print.refundable.button", { amount: amount(stake), symbol }),
                run: () => void casinoRound.manualRefund?.()
              }
            : undefined
        };
      case "result_unbooked":
        return { title: t("print.unbooked.title"), note: t("print.unbooked.note") };
      case "failed":
        return { title: t("print.failed.title"), note: t("print.failed.note") };
      default:
        return { title: t("print.settling.title"), note: t("print.settling.note") };
    }
  })();
  const feeding = phase !== "refundable" && phase !== "failed" && phase !== "result_unbooked";
  const betId = bet?.betId ?? casinoRound.activeBetId;

  return (
    <article aria-label={t("slip.label")} aria-busy="true" className={SHEET}>
      <SlipHeader
        right={betId != null ? tReceipt("bet", { id: betId.toString() }) : t("slip.title")}
      />
      <p className="mt-4 text-lede font-semibold">{gameLine}</p>
      <hr className={DIVIDER} />
      <div role="status">
        <p className="text-lede font-semibold">{title}</p>
        {feeding ? (
          <div aria-hidden="true" className="print-feed my-3 h-3 motion-safe:animate-feed" />
        ) : null}
        <p className={`text-note text-faded ${feeding ? "" : "mt-2"}`}>{note}</p>
      </div>
      <hr className={DIVIDER} />
      <ul>
        <QuoteLine label={tReceipt("lines.stake")} value={`${amount(stake)} ${symbol}`} />
        <QuoteLine
          label={rounds > 1 ? t("slip.eachWin") : t("slip.ifWin")}
          value={winPays == null ? "—" : `${amount(winPays)} ${symbol}`}
        />
      </ul>
      {action ? (
        <div className="mt-4">
          <button type="button" onClick={action.run} className={`${MAIN_BUTTON} w-full`}>
            <b className="font-semibold">{action.label}</b>
          </button>
        </div>
      ) : null}
      {phase === "failed" || phase === "result_unbooked" ? (
        <p className="mt-4 text-note">
          <Link
            href={betId != null ? `/portfolio/activity/${betId.toString()}` : "/portfolio/activity"}
            className={LINK}
          >
            {t("print.open")}
          </Link>
        </p>
      ) : null}
    </article>
  );
}

function useNow(ticking: boolean) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);
  return now;
}
