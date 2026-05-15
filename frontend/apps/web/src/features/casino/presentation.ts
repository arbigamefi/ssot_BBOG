export type GamePresentation = {
  icon: string;
  listDescription: string;
  detailDescription: string;
  helpLabel: string;
  helpDescription: string;
  roomLabel: string;
  roomSummary: string;
  playbook: string[];
  previewSteps: Array<{
    title: string;
    body: string;
  }>;
  cardFacts: string[];
  theme: {
    badgeClassName: string;
    ambientClassName: string;
    stageClassName: string;
    accentClassName: string;
  };
};

const CASINO_PRESENTATION_THEME: GamePresentation["theme"] = {
  badgeClassName: "border-brand/30 bg-brand-soft text-brand",
  ambientClassName: "bg-brand-soft",
  stageClassName: "bg-surface-1",
  accentClassName: "text-brand"
};

const GAME_PRESENTATION: Record<string, GamePresentation> = {
  dice: {
    icon: "🎲",
    listDescription: "Set the cap, size the ticket, and step into a fast dice room.",
    detailDescription:
      "Choose a cap, preview the ticket, and place the bet with settlement still visible underneath the room layer.",
    helpLabel: "Cap-driven payout profile",
    helpDescription:
      "Lower caps usually imply lower hit probability and higher payout multiples. Use the board on the left, then confirm the quote on the right.",
    roomLabel: "Precision room",
    roomSummary:
      "Set the cap, size the slip, and keep the roll centered on one clean room surface.",
    playbook: [
      "Tune the cap to shape your risk curve before you ever sign a transaction.",
      "Plan first to quote VRF fee, stake, and approval requirements against the active release.",
      "Watch the live table after submission so your betId and state transition stay auditable."
    ],
    previewSteps: [
      { title: "Set the cap", body: "Move the threshold until the risk curve feels right." },
      { title: "Size the slip", body: "Adjust amount and rounds without leaving the room." },
      { title: "Watch the roll", body: "Follow the live table after the ticket is sent." }
    ],
    cardFacts: ["Fast ticket", "Live settlement", "Single asset"],
    theme: CASINO_PRESENTATION_THEME
  },
  "coin-toss": {
    icon: "🪙",
    listDescription: "Heads or tails with the cleanest room entry on the floor.",
    detailDescription:
      "Select heads or tails, review the ticket, and place a clean binary bet without extra room clutter.",
    helpLabel: "Binary outcome flow",
    helpDescription:
      "Coin Toss uses a single boolean parameter. It is the cleanest room for validating allowance, VRF fee, and stepper behavior without extra game-shape complexity.",
    roomLabel: "Binary room",
    roomSummary:
      "Fastest path from choice to settlement. One switch, one plan, one on-chain outcome.",
    playbook: [
      "Choose a side and use the preview to verify the exact cost of entering the room.",
      "Keep stake sizing disciplined because the UI is intentionally minimal and fast-moving.",
      "Use the recent activity table to inspect how this room is resolving in the current release."
    ],
    previewSteps: [
      { title: "Call the side", body: "Pick heads or tails in one obvious move." },
      { title: "Set the amount", body: "Use chips or type the exact stake on the slip." },
      { title: "Check the outcome", body: "Track the result without extra room clutter." }
    ],
    cardFacts: ["Quick entry", "Binary play", "Single outcome"],
    theme: CASINO_PRESENTATION_THEME
  },
  roulette: {
    icon: "🎯",
    listDescription:
      "Step into a standard European roulette table with a real board, a clear slip, and readable ticket review.",
    detailDescription:
      "Choose a standard European roulette bet, review the ticket, and keep the room focused on the table instead of protocol panels.",
    helpLabel: "European table flow",
    helpDescription:
      "Roulette supports standard table bets such as straight, split, street, corner, six line, dozen, column, and even-money calls. Raw bitmask input stays available only as an advanced fallback.",
    roomLabel: "European table",
    roomSummary:
      "A flagship European room with a standard 0-36 board, compact slip, and cleaner ticket review.",
    playbook: [
      "Start with the standard table first so the main interaction stays legible in one glance.",
      "Use ticket review to confirm the bet type, stake, and quote before signing.",
      "Drop into the advanced fallback only when you intentionally need raw bitmask entry."
    ],
    previewSteps: [
      { title: "Pick the board", body: "Choose a straight, dozen, column, or even-money call." },
      { title: "Build the ticket", body: "Keep stake, rounds, and review on one compact slip." },
      { title: "Stay on the table", body: "Ledger and protocol detail remain below the fold." }
    ],
    cardFacts: ["0-36 table", "Clear slip", "Standard bets"],
    theme: CASINO_PRESENTATION_THEME
  },
  keno: {
    icon: "🔢",
    listDescription: "Pick the board, size the ticket, and keep the draw centered on the room.",
    detailDescription:
      "Use the Keno board first, then size the ticket and follow settlement without dropping into a form-heavy view.",
    helpLabel: "Packed number selection",
    helpDescription:
      "Keno relies on a uint40-style packed selection. Keep the input valid and use the release metadata as the final authority for routing and encoding expectations.",
    roomLabel: "Matrix room",
    roomSummary: "Pick the grid, size the ticket, and keep the Keno board as the main event.",
    playbook: [
      "Build a valid packed selection and keep the mask non-zero before planning.",
      "Review VRF fee and stake totals because multi-bet flows can compound faster here.",
      "Use the room table after mining to confirm the state machine reconciles cleanly."
    ],
    previewSteps: [
      { title: "Mark the grid", body: "Build a number selection directly on the board." },
      { title: "Set the stake", body: "Choose chips and rounds on the side slip." },
      { title: "Follow the draw", body: "Use the live table to watch each ticket settle." }
    ],
    cardFacts: ["Board-first", "Live draw", "Repeat plays"],
    theme: CASINO_PRESENTATION_THEME
  }
};

export function getGamePresentation(slug: string, label: string): GamePresentation {
  return (
    GAME_PRESENTATION[slug] ?? {
      icon: "🎮",
      listDescription: `Play ${label} using the active release bundle and standardized on-chain bet flow.`,
      detailDescription: `Place a release-routed bet on ${label}. Routing, module lookup, and params encoding come from the active release manifest.`,
      helpLabel: "Release-routed gameplay",
      helpDescription:
        "This room uses governed UI presentation metadata, but protocol truth still comes from the active release and indexer layers. Verify the plan preview before signing.",
      roomLabel: "Release room",
      roomSummary:
        "Governed presentation on top of release-routed execution, with local facts keeping the room auditable.",
      playbook: [
        "Configure the game-specific params using the release-bound form for this route.",
        "Plan before execution so stake, approval, and VRF fee are explicit.",
        "Use recent activity and explorer links to verify the room is behaving as expected."
      ],
      previewSteps: [
        { title: "Enter the room", body: "Start with the game surface, not the protocol layer." },
        { title: "Build the ticket", body: "Keep stake and review on one compact slip." },
        { title: "Track settlement", body: "Follow the result on the live table after signing." }
      ],
      cardFacts: ["Room-first", "Wallet-native", "Readable settlement"],
      theme: CASINO_PRESENTATION_THEME
    }
  );
}
