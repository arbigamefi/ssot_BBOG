import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GameRoomRightPane } from "./right-pane";

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      "casino.room.selection.dice.rollUnder": "Roll Under",
      "casino.room.selection.dice.rollOver": "Roll Over",
      "casino.room.selection.dice.targetRange": "Target Range",
      "casino.room.selection.dice.targetAria": "Dice target",
      "casino.room.selection.dice.target": "Target",
      "casino.room.selection.dice.multiplier": "Mult",
      "casino.room.selection.dice.winChance": "Win",
      "casino.room.stage.loading": "Loading stage",
      "casino.room.history.recent.rolls": "RECENT ROLLS",
      "casino.room.history.recent.numbers": "RECENT NUMBERS",
      "casino.room.history.recent.draws": "RECENT DRAWS",
      "casino.room.history.recent.buckets": "RECENT BUCKETS",
      "casino.room.history.recent.slots": "RECENT SLOTS",
      "casino.room.history.recent.hands": "RECENT HANDS",
      "casino.room.history.recent.dice": "RECENT DICE",
      "casino.room.history.recent.flips": "RECENT FLIPS",
      "casino.room.history.states.settled": "SETTLED",
      "casino.room.history.states.refunded": "REFUNDED",
      "casino.room.history.states.vrfReady": "VRF READY",
      "casino.room.history.states.placed": "PLACED",
      "casino.room.history.empty": "Waiting for first play...",
      "casino.room.result.title": "Bet details",
      "casino.room.result.outcomes.refunded.label": "Stake refunded",
      "casino.room.result.outcomes.refunded.detail":
        "The refund path returned the stake after the VRF timeout window.",
      "casino.room.result.outcomes.win.label": "Won bet",
      "casino.room.result.outcomes.win.detail":
        "The round settled on-chain and payout is confirmed.",
      "casino.room.result.outcomes.returned.label": "Stake returned",
      "casino.room.result.outcomes.returned.detail": "The settled payout equals the stake.",
      "casino.room.result.outcomes.loss.label": "Lost bet",
      "casino.room.result.outcomes.loss.detail": "The round settled on-chain with no net payout.",
      "casino.room.result.outcomes.winPending.label": "Won bet",
      "casino.room.result.outcomes.winPending.detail":
        "The VRF result is revealed. Payout settlement is still pending.",
      "casino.room.result.outcomes.returnedPending.label": "Stake returned",
      "casino.room.result.outcomes.returnedPending.detail":
        "The VRF result is revealed. Settlement confirmation is still pending.",
      "casino.room.result.outcomes.lossPending.label": "Lost bet",
      "casino.room.result.outcomes.lossPending.detail":
        "The VRF result is revealed. Final settlement is still pending.",
      "casino.room.result.outcomes.revealed.label": "Result revealed",
      "casino.room.result.outcomes.revealed.detail":
        "Opened numbers are available from VRF. Settlement is still pending.",
      "casino.room.result.sections.gameResult": "Game result",
      "casino.room.result.sections.fairnessData": "Fairness data",
      "casino.room.result.facts.status": "Status",
      "casino.room.result.facts.player": "Player",
      "casino.room.result.facts.multiplier": "Multiplier",
      "casino.room.result.facts.betAmount": "Bet amount",
      "casino.room.result.facts.payout": "Payout",
      "casino.room.result.facts.expectedPayout": "Expected payout",
      "casino.room.result.facts.betId": "Bet ID",
      "casino.room.result.facts.refund": "Refund",
      "casino.room.result.facts.requestId": "Request ID",
      "casino.room.result.facts.netResult": "Net result",
      "casino.room.result.facts.randomHash": "Random hash",
      "casino.room.result.facts.settlementTx": "Settlement tx",
      "casino.room.result.facts.resolvedTime": "Resolved time",
      "casino.room.result.facts.vrfFee": "RNG fees (VRF)",
      "casino.room.result.facts.pending": "Pending",
      "casino.room.result.facts.diceTarget": "Dice target",
      "casino.room.result.facts.diceNumber": "Number drawn",
      "casino.room.result.facts.coinChoice": "Chosen side",
      "casino.room.result.facts.coinDrawn": "Side drawn",
      "casino.room.result.facts.rouletteBet": "Roulette bet",
      "casino.room.result.facts.rouletteWinningNumber": "Winning number",
      "casino.room.result.facts.kenoPicked": "Numbers picked",
      "casino.room.result.facts.kenoDrawn": "Numbers drawn",
      "casino.room.result.facts.kenoHits": "Hits",
      "casino.room.result.facts.plinkoRisk": "Risk profile",
      "casino.room.result.facts.plinkoSlot": "Slot",
      "casino.room.result.facts.plinkoPath": "Path",
      "casino.room.result.facts.plinkoMultiplier": "Slot multiplier",
      "casino.room.result.facts.slotsProfile": "Profile",
      "casino.room.result.facts.slotsSymbols": "Symbols drawn",
      "casino.room.result.facts.slotsMultiplier": "Reel multiplier",
      "casino.room.result.facts.slotsJackpot": "Jackpot",
      "casino.room.result.facts.baccaratChoice": "Chosen side",
      "casino.room.result.facts.baccaratWinner": "Winning side",
      "casino.room.result.facts.baccaratPlayerTotal": "Player total",
      "casino.room.result.facts.baccaratBankerTotal": "Banker total",
      "casino.room.result.facts.baccaratPlayerCards": "Player cards",
      "casino.room.result.facts.baccaratBankerCards": "Banker cards",
      "casino.room.result.facts.sicBoBet": "Sic Bo bet",
      "casino.room.result.facts.sicBoDice": "Dice opened",
      "casino.room.result.facts.sicBoTotal": "Total",
      "casino.room.result.facts.sicBoTriple": "Triple",
      "casino.room.result.facts.sicBoMultiplier": "Roll multiplier",
      "casino.room.selection.plinko.low": "Low",
      "casino.room.selection.plinko.medium": "Medium",
      "casino.room.selection.plinko.high": "High",
      "casino.room.selection.slots.profiles.classic": "Classic 3 reels",
      "casino.room.selection.slots.symbols.0": "Cherry",
      "casino.room.selection.slots.symbols.1": "Lemon",
      "casino.room.selection.slots.symbols.2": "Bell",
      "casino.room.selection.slots.symbols.3": "Diamond",
      "casino.room.selection.slots.symbols.4": "Crown",
      "casino.room.selection.slots.symbols.5": "Star",
      "casino.room.selection.slots.symbols.6": "Bar",
      "casino.room.selection.slots.symbols.7": "Seven",
      "casino.room.selection.slots.yes": "Yes",
      "casino.room.selection.slots.no": "No",
      "casino.room.selection.baccarat.player": "Player",
      "casino.room.selection.baccarat.banker": "Banker",
      "casino.room.selection.baccarat.tie": "Tie",
      "casino.room.selection.sicBo.kinds.small": "Small",
      "casino.room.selection.sicBo.kinds.big": "Big",
      "casino.room.selection.sicBo.kinds.anyTriple": "Any triple",
      "casino.room.selection.sicBo.kinds.specificTriple": "Specific triple",
      "casino.room.selection.sicBo.kinds.total": "Exact total",
      "casino.room.selection.sicBo.kinds.specificDouble": "Specific double",
      "casino.room.selection.sicBo.kinds.singleFace": "Single face",
      "casino.room.stage.plinko.dropZone": "Set risk and drop",
      "casino.room.stage.plinko.waitingVrf": "Waiting for VRF oracle...",
      "casino.room.stage.plinko.slot": "Slot {slot}",
      "casino.room.stage.plinko.risk": "Risk: {risk}",
      "casino.room.stage.slots.ready": "Match 3 symbols to win",
      "casino.room.stage.slots.spinning": "Waiting for VRF oracle...",
      "casino.room.stage.slots.result": "Cherry / Seven / Seven",
      "casino.room.stage.slots.classic": "Classic profile",
      "casino.room.stage.baccarat.ready": "Bet player, banker, or tie",
      "casino.room.stage.baccarat.dealing": "Waiting for VRF oracle...",
      "casino.room.stage.baccarat.result": "Player wins",
      "casino.room.stage.baccarat.selected": "Selected: Player",
      "casino.room.stage.sicBo.ready": "Choose a Sic Bo table bet",
      "casino.room.stage.sicBo.rolling": "Waiting for VRF oracle...",
      "casino.room.stage.sicBo.opened": "Dice opened: 2 / 3 / 4",
      "casino.room.stage.sicBo.total": "Total",
      "casino.room.stage.sicBo.triple": "Triple",
      "casino.room.stage.sicBo.result": "Result",
      "casino.room.result.actions.close": "Close",
      "casino.room.result.actions.viewSettlement": "View settlement",
      "casino.room.result.actions.settlementPending": "Settlement pending"
    })[key] ?? key
}));

const baseProps = {
  coinSide: "HEADS" as const,
  gameHistory: [],
  recentBets: [],
  isPending: false,
  showResult: false,
  resultNum: null,
  diceDirection: "under" as const,
  diceTarget: 50,
  multiplier: 1.98,
  winChance: 50,
  rouletteSpots: [],
  kenoSpots: [],
  plinkoRisk: "medium" as const,
  baccaratSide: "player" as const,
  sicBoKind: "small" as const,
  sicBoValue: 0,
  plinkoBuckets: [],
  slotsSymbols: [],
  animatingKenoSpots: [],
  kenoResultDrawn: [],
  resultProof: null,
  chainId: 84532,
  assetSymbol: "USDC",
  assetDecimals: 6,
  onResultClose: vi.fn(),
  onDiceDirectionChange: vi.fn(),
  onDiceTargetChange: vi.fn(),
  onRouletteChange: vi.fn(),
  onKenoChange: vi.fn(),
  onKenoResetResult: vi.fn()
};

describe("GameRoomRightPane", () => {
  afterEach(() => cleanup());

  it("renders the empty live tracker and dice stage", async () => {
    render(<GameRoomRightPane {...baseProps} gameSlug="dice" />);

    expect(screen.getByText("RECENT ROLLS")).toBeDefined();
    expect(screen.getByText("Waiting for first play...")).toBeDefined();
    expect(await screen.findByText("Roll Under")).toBeDefined();
  });

  it("renders chain bet status and result overlay", () => {
    render(
      <GameRoomRightPane
        {...baseProps}
        gameSlug="roulette"
        showResult
        resultNum={17}
        resultProof={{
          kind: "settled",
          betId: 123456n,
          requestId: 88n,
          randomHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          player: "0xc8ec9920d573893e888db5d30b2b3b3824b1b684",
          stake: 10_000_000n,
          vrfFeeCharged: 100_000_000_000_000n,
          resolvedAt: 1_778_888_888,
          settlement: {
            txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            payoutGross: 20_000_000n,
            payoutNet: 19_600_000n,
            feeOnPayout: 400_000n,
            protocolFeeAccrual: 200_000n
          }
        }}
        gameHistory={[{ val: 17, win: true }]}
        recentBets={[{ id: "84532:123456", betId: "123456", state: "finalized" }]}
      />
    );

    expect(screen.getByText("RECENT NUMBERS")).toBeDefined();
    expect(screen.getByText("SETTLED")).toBeDefined();
    expect(screen.getAllByText("Won bet").length).toBeGreaterThan(0);
    expect(screen.getByText("Bet details")).toBeDefined();
    expect(screen.getByText("Game result")).toBeDefined();
    expect(screen.getByText("Fairness data")).toBeDefined();
    expect(screen.getByText("19.6 USDC")).toBeDefined();
    expect(screen.getByText("+ 9.6 USDC")).toBeDefined();
    expect(screen.getAllByText("17").length).toBeGreaterThan(0);
  });

  it("does not open the result overlay until terminal proof is available", () => {
    render(
      <GameRoomRightPane
        {...baseProps}
        gameSlug="roulette"
        showResult
        resultProof={{
          kind: "indexing",
          betId: 13n,
          requestId: 88n,
          randomHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          player: "0xc8ec9920d573893e888db5d30b2b3b3824b1b684",
          stake: 10_000_000n
        }}
      />
    );

    expect(screen.queryByText("Bet details")).toBeNull();
    expect(screen.queryByText("Reading result")).toBeNull();
    expect(screen.queryByText("Won bet")).toBeNull();
  });

  it("opens the result overlay before settlement when VRF outcome is available", () => {
    render(
      <GameRoomRightPane
        {...baseProps}
        gameSlug="dice"
        showResult
        resultProof={{
          kind: "indexing",
          betId: 13n,
          requestId: 88n,
          randomHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          player: "0xc8ec9920d573893e888db5d30b2b3b3824b1b684",
          stake: 10_000_000n,
          vrfFeeCharged: 100_000_000_000_000n,
          resolvedAt: 1_778_888_888
        }}
        casinoOutcome={{
          kind: "dice",
          direction: "under",
          target: 50,
          rolls: [{ value: 17, won: true }],
          payoutGross: 20_000_000n,
          payoutNet: 19_600_000n,
          refundAmount: 0n,
          feeOnPayout: 400_000n,
          playerOwed: 19_600_000n,
          netResult: 9_600_000n
        }}
      />
    );

    expect(screen.getByText("Bet details")).toBeDefined();
    expect(screen.getAllByText("Won bet").length).toBeGreaterThan(0);
    expect(screen.getByText("Expected payout")).toBeDefined();
    expect(screen.getByText("Number drawn")).toBeDefined();
    expect(screen.getAllByText("17").length).toBeGreaterThan(0);
    expect(screen.getByText("Pending")).toBeDefined();
    expect(screen.getByText("Settlement pending")).toBeDefined();
  });

  it("shows slots symbols, multiplier, and jackpot detail in the result overlay", () => {
    render(
      <GameRoomRightPane
        {...baseProps}
        gameSlug="slots"
        showResult
        slotsSymbols={[7, 7, 7]}
        resultProof={{
          kind: "settled",
          betId: 77n,
          requestId: 88n,
          randomHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          player: "0xc8ec9920d573893e888db5d30b2b3b3824b1b684",
          stake: 10_000_000n,
          vrfFeeCharged: 100_000_000_000_000n,
          resolvedAt: 1_778_888_888,
          settlement: {
            txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            payoutGross: 640_000_000n,
            payoutNet: 627_200_000n,
            feeOnPayout: 12_800_000n,
            protocolFeeAccrual: 6_400_000n
          }
        }}
        casinoOutcome={{
          kind: "slots",
          profile: "classic",
          rolls: [{ symbols: [7, 7, 7], multiplier: 64, won: true, jackpot: true }],
          payoutGross: 640_000_000n,
          payoutNet: 627_200_000n,
          refundAmount: 0n,
          feeOnPayout: 12_800_000n,
          playerOwed: 627_200_000n,
          netResult: 617_200_000n
        }}
      />
    );

    expect(screen.getByText("Symbols drawn")).toBeDefined();
    expect(screen.getByText("Seven / Seven / Seven")).toBeDefined();
    expect(screen.getByText("64.00x")).toBeDefined();
    expect(screen.getByText("Jackpot")).toBeDefined();
    expect(screen.getByText("Yes")).toBeDefined();
  });

  it("shows baccarat opened cards, totals, and winning side in the result overlay", () => {
    render(
      <GameRoomRightPane
        {...baseProps}
        gameSlug="baccarat"
        showResult
        resultProof={{
          kind: "settled",
          betId: 78n,
          requestId: 89n,
          randomHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          player: "0xc8ec9920d573893e888db5d30b2b3b3824b1b684",
          stake: 10_000_000n,
          vrfFeeCharged: 100_000_000_000_000n,
          resolvedAt: 1_778_888_888,
          settlement: {
            txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            payoutGross: 22_414_000n,
            payoutNet: 21_965_720n,
            feeOnPayout: 448_280n,
            protocolFeeAccrual: 224_140n
          }
        }}
        casinoOutcome={{
          kind: "baccarat",
          side: "player",
          rolls: [
            {
              playerCards: [5, 4],
              bankerCards: [8, 0],
              playerTotal: 9,
              bankerTotal: 8,
              outcome: "player",
              factorBps: 22414,
              won: true
            }
          ],
          payoutGross: 22_414_000n,
          payoutNet: 21_965_720n,
          refundAmount: 0n,
          feeOnPayout: 448_280n,
          playerOwed: 21_965_720n,
          netResult: 11_965_720n
        }}
      />
    );

    expect(screen.getByText("RECENT HANDS")).toBeDefined();
    expect(screen.getByText("Winning side")).toBeDefined();
    expect(screen.getAllByText("Player").length).toBeGreaterThan(0);
    expect(screen.getByText("Player cards")).toBeDefined();
    expect(screen.getByText("5, 4")).toBeDefined();
    expect(screen.getByText("Banker cards")).toBeDefined();
    expect(screen.getByText("8, 0")).toBeDefined();
  });

  it("shows sic bo dice, total, and bet detail in the result overlay", () => {
    render(
      <GameRoomRightPane
        {...baseProps}
        gameSlug="sic-bo"
        showResult
        sicBoKind="total"
        sicBoValue={9}
        resultProof={{
          kind: "settled",
          betId: 79n,
          requestId: 90n,
          randomHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          player: "0xc8ec9920d573893e888db5d30b2b3b3824b1b684",
          stake: 10_000_000n,
          vrfFeeCharged: 100_000_000_000_000n,
          resolvedAt: 1_778_888_888,
          settlement: {
            txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            payoutGross: 86_400_000n,
            payoutNet: 84_672_000n,
            feeOnPayout: 1_728_000n,
            protocolFeeAccrual: 864_000n
          }
        }}
        casinoOutcome={{
          kind: "sic-bo",
          betKind: "total",
          betValue: 9,
          rolls: [
            {
              dice: [2, 3, 4],
              total: 9,
              triple: false,
              faceCount: 0,
              factorBps: 86_400,
              won: true
            }
          ],
          payoutGross: 86_400_000n,
          payoutNet: 84_672_000n,
          refundAmount: 0n,
          feeOnPayout: 1_728_000n,
          playerOwed: 84_672_000n,
          netResult: 74_672_000n
        }}
      />
    );

    expect(screen.getByText("RECENT DICE")).toBeDefined();
    expect(screen.getByText("Sic Bo bet")).toBeDefined();
    expect(screen.getByText("Exact total 9")).toBeDefined();
    expect(screen.getByText("Dice opened")).toBeDefined();
    expect(screen.getByText("2 / 3 / 4")).toBeDefined();
    expect(screen.getByText("Total")).toBeDefined();
  });
});
