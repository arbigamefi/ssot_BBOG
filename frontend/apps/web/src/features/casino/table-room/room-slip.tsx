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
import { useNow } from "./printer";
import { RoomReceipt, type ReceiptGame } from "./room-receipt";
import { SheetHead, type SlipSheet } from "./sheet-head";
import {
  deriveSlipQuote,
  formatQuote,
  formatStake,
  quoteRaw,
  slipMaxStake,
  stakeText,
  type SlipAction,
  type SlipNotice
} from "./slip-model";
import { DIVIDER, LINE_BUTTON, LINK, MAIN_BUTTON, SHEET, SHEET_FULL } from "./styles";

/** What the slip needs to know about the game in the room. */
export type SlipGame = {
  /** Prefixes the slip's field ids: "dice", "roulette". */
  id: string;
  /** The bet in one line: "Dice, win on 1–50", "Roulette, 1–12 + 17". */
  line: string;
  /** The numbers it covers, when the line does not say: "Covers 1–12, 17". */
  covers?: string;
  /** The win chance in the notice for a stake over the limit: "50", "32.4". */
  chance: string;
  /** One winning round's payout at a house edge. */
  payout: (perRound: bigint, houseEdgeBps: number) => bigint;
  /** A game that needs a selection first, while it has none, or all of it. */
  selection?: "empty" | "all";
  /** What the slip says then. */
  selectionNotice?: { lead: string; body: string };
  /** The receipt's lines about the game. */
  receipt: ReceiptGame;
};

/**
 * The bet slip is the quote. Once the bet is placed a waiting slip feeds out of the printer's
 * slot, the receipt prints when the ball stops, and "Bet again" or "Change bet" tears it off. The
 * main button keeps one place in every state. On a phone the slip is a sheet docked to the bottom
 * of the screen: closed, it shows one summary line and the action.
 */
export function RoomSlip({
  game,
  room,
  access,
  chainName,
  houseEdgeRate,
  holdReceipt,
  className
}: {
  game: SlipGame;
  room: GameRoom;
  access: CasinoAccess;
  chainName: string;
  houseEdgeRate: string;
  /** The ball is still rolling to the result; the receipt prints once it stops. */
  holdReceipt: boolean;
  className: string;
}) {
  const t = useTranslations("casino.table");
  const { casinoRound } = room;
  const status = casinoRound.state.status;
  const signing = status === "planning" || status === "submitting";
  const result =
    room.showResult && !holdReceipt && isCasinoTerminalRoundResult(room.resultProof)
      ? room.resultProof
      : null;
  const printing = !result && !signing && room.isBetPanelPending;
  const phase = room.placeBetButtonPhase;
  const [receiptNews, setReceiptNews] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const sheet = { open, toggle: () => setOpen((current) => !current) };

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
    <div
      data-slip=""
      data-closed={open ? undefined : ""}
      className={`group/sheet overflow-clip px-2 [overflow-clip-margin:8px] max-[720px]:fixed max-[720px]:inset-x-0 max-[720px]:top-auto max-[720px]:bottom-0 max-[720px]:z-30 max-[720px]:max-h-[86vh] max-[720px]:overflow-auto max-[720px]:overscroll-contain max-[720px]:px-0 ${className}`}
    >
      {result ? (
        <RoomReceipt
          game={game.receipt}
          room={room}
          result={result}
          chainName={chainName}
          houseEdgeRate={houseEdgeRate}
          onAnnounce={setReceiptNews}
          sheet={sheet}
        />
      ) : printing ? (
        <PrintingSlip game={game} room={room} sheet={sheet} />
      ) : (
        <QuoteSlip game={game} room={room} access={access} chainName={chainName} sheet={sheet} />
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
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

/** The bet's line, and under it the numbers it covers when the line does not say. */
function GameLine({ game }: { game: SlipGame }) {
  return (
    <>
      <p className="mt-4 text-lede font-semibold">{game.line}</p>
      {game.covers ? <p className="mt-1 text-note text-faded">{game.covers}</p> : null}
    </>
  );
}

function QuoteSlip({
  game,
  room,
  access,
  chainName,
  sheet
}: {
  game: SlipGame;
  room: GameRoom;
  access: CasinoAccess;
  chainName: string;
  sheet: SlipSheet;
}) {
  const t = useTranslations("casino.table");
  const gameLine = game.line;
  const { casinoRound, assetDecimals: decimals, assetSymbol: symbol } = room;
  const { state } = casinoRound;
  const status = state.status;
  const signing = status === "planning" || status === "submitting";
  const maxRounds = Math.max(1, casinoRound.maxBetCount ?? 1);
  const rounds = room.betCount;
  const perRound = betAmountInputToRaw(room.betAmount, decimals);
  const total = perRound * BigInt(Math.max(1, rounds));
  const bps = room.houseEdgeBps;
  const winPays =
    bps == null || perRound === 0n || game.selection ? undefined : game.payout(perRound, bps);
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
    decimals,
    selection: game.selection
  });
  const minStake = quoteRaw(minPerRound, decimals, "up");
  const maxStake = slipMaxStake({ poolMaxPerRound, balance, rounds, decimals });
  const locked = signing || access === "preview";
  const amount = (raw: bigint) => formatQuote(raw, decimals);
  const setStake = (raw: bigint) => room.setBetAmount(stakeText(raw, decimals));

  const [roundsText, setRoundsText] = React.useState(String(rounds));
  React.useEffect(() => setRoundsText(String(rounds)), [rounds]);
  const changeRounds = (next: number) =>
    room.setBetCount(Math.min(maxRounds, Math.max(1, Math.floor(next))));

  const winLabel = rounds > 1 ? t("slip.eachWin") : t("slip.ifWin");
  const winText = winPays == null ? "—" : `${amount(winPays)} ${symbol}`;
  const bad = ["min", "overMax", "balance"].includes(quote.notice?.kind ?? "");

  const place = () => void casinoRound.placeBet();

  return (
    <article aria-label={t("slip.label")} className={SHEET}>
      <SheetHead
        sheet={sheet}
        title={rounds > 1 ? t("slip.gameRounds", { game: gameLine, rounds }) : gameLine}
      >
        <span className="text-note whitespace-nowrap text-faded">
          {winLabel} {winText}
        </span>
      </SheetHead>
      <div className={SHEET_FULL}>
        <SlipHeader right={t("slip.title")} />
        <GameLine game={game} />
        <hr className={DIVIDER} />
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

      <div className={`flex items-center justify-between gap-4 ${SHEET_FULL}`}>
        <label htmlFor={`${game.id}-rounds`} className="font-semibold">
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
            id={`${game.id}-rounds`}
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

      <div
        className={`mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 ${SHEET_FULL}`}
      >
        <label htmlFor={`${game.id}-stake`} className="font-semibold">
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

      <div className="mt-4 max-[720px]:group-data-closed/sheet:mt-2">
        {quote.notice ? (
          <SlipNoticeText
            notice={quote.notice}
            game={game}
            room={room}
            chainName={chainName}
            maxRounds={maxRounds}
          />
        ) : null}
        <div
          className={`flex flex-wrap gap-1 rounded-sheet border-ink max-md:[&>*:last-child]:flex-[1_0_auto] ${
            bad ? "border-2 p-[3px]" : "border p-1"
          }`}
        >
          <span className="flex min-w-0 flex-[1000_1_112px] items-center md:flex-1">
            <input
              id={`${game.id}-stake`}
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
        <p className={`mt-4 text-note text-faded ${SHEET_FULL}`}>
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
  game,
  room,
  chainName,
  maxRounds
}: {
  notice: SlipNotice;
  game: SlipGame;
  room: GameRoom;
  chainName: string;
  maxRounds: number;
}) {
  const t = useTranslations("casino.table.notice");
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
                chance: game.chance,
                amount: formatStake(notice.max, room.assetDecimals),
                symbol
              })
            : t("overMax.body", {
                chance: game.chance,
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
      case "selection":
        return [game.selectionNotice?.lead ?? "", game.selectionNotice?.body ?? ""];
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
  const t = useTranslations("casino.table.action");
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

/** Placed and waiting: the paper is printing, so its edge is still plain. */
function PrintingSlip({ game, room, sheet }: { game: SlipGame; room: GameRoom; sheet: SlipSheet }) {
  const t = useTranslations("casino.table");
  const locale = useLocale();
  const { casinoRound, assetSymbol: symbol, assetDecimals: decimals } = room;
  const bet = casinoRound.activeBet;
  const phase = room.placeBetButtonPhase;
  const now = useNow(phase === "waiting_vrf");
  const amount = (raw: bigint) => formatQuote(raw, decimals);
  const perRound = bet?.amountPerRoll ?? betAmountInputToRaw(room.betAmount, decimals);
  const stake = bet?.stake ?? perRound * BigInt(Math.max(1, room.betCount));
  const bps = bet?.houseEdgeBps ?? room.houseEdgeBps;
  const winPays = bps == null ? undefined : game.payout(perRound, bps);
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
    <article
      aria-label={t("slip.label")}
      aria-busy="true"
      className={`${SHEET} motion-safe:animate-print [--print-delay:0s] [--print-time:0.5s] max-[720px]:animate-none`}
    >
      <SheetHead sheet={sheet} title={title}>
        {phase === "waiting_vrf" ? (
          <span className="text-note whitespace-nowrap text-faded tabular-nums">
            {t("print.seconds", { seconds })}
          </span>
        ) : null}
      </SheetHead>
      <div className={SHEET_FULL}>
        <SlipHeader
          right={betId != null ? t("receipt.bet", { id: betId.toString() }) : t("slip.title")}
        />
        <GameLine game={game} />
        <hr className={DIVIDER} />
      </div>
      <div role="status" className={SHEET_FULL}>
        <p className="text-lede font-semibold">{title}</p>
        {feeding ? (
          <div aria-hidden="true" className="print-feed my-3 h-3 motion-safe:animate-feed" />
        ) : null}
        <p className={`text-note text-faded ${feeding ? "" : "mt-2"}`}>{note}</p>
      </div>
      <div className={SHEET_FULL}>
        <hr className={DIVIDER} />
        <ul>
          <QuoteLine label={t("receipt.lines.stake")} value={`${amount(stake)} ${symbol}`} />
          <QuoteLine
            label={rounds > 1 ? t("slip.eachWin") : t("slip.ifWin")}
            value={winPays == null ? "—" : `${amount(winPays)} ${symbol}`}
          />
        </ul>
      </div>
      {action ? (
        <div className="mt-4">
          <button type="button" onClick={action.run} className={`${MAIN_BUTTON} w-full`}>
            <b className="font-semibold">{action.label}</b>
          </button>
        </div>
      ) : null}
      {phase === "failed" || phase === "result_unbooked" ? (
        <p className="mt-4 text-note max-[720px]:mb-2">
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
