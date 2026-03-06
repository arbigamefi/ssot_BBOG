export type GamePresentation = {
  icon: string;
  listDescription: string;
  detailDescription: string;
  helpLabel: string;
  helpDescription: string;
};

const GAME_PRESENTATION: Record<string, GamePresentation> = {
  dice: {
    icon: "🎲",
    listDescription: "Set a cap, size your stake, and let the release-routed dice module settle the outcome on-chain.",
    detailDescription:
      "Choose an over-under style cap, preview the exact stake and VRF fee, then submit a release-routed dice bet through the canonical Hub flow.",
    helpLabel: "Cap-driven payout profile",
    helpDescription:
      "Lower caps usually imply lower hit probability and higher payout multiples. Treat the params form as the canonical input surface and verify the final plan before signing.",
  },
  "coin-toss": {
    icon: "🪙",
    listDescription: "Heads or tails with the simplest possible parameter model and the same on-chain execution guarantees.",
    detailDescription:
      "Select heads or tails, review the plan, and place a release-routed coin toss bet with fully on-chain settlement and VRF-backed randomness.",
    helpLabel: "Binary outcome flow",
    helpDescription:
      "Coin Toss uses a single boolean parameter. It is the cleanest room for validating allowance, VRF fee, and stepper behavior without extra game-shape complexity.",
  },
  roulette: {
    icon: "🎯",
    listDescription: "Compose a legacy roulette mask, inspect the encoded selection, and send the bet through the current release manifest.",
    detailDescription:
      "Build a roulette mask, confirm the encoded payload shape, and place the bet against the module address defined by the active release bundle.",
    helpLabel: "Legacy mask selection",
    helpDescription:
      "Roulette currently encodes selections as a uint40-compatible mask. Review the release-provided params encoding on every environment because the UI must follow the active manifest, not page-local assumptions.",
  },
  keno: {
    icon: "🔢",
    listDescription: "Pick a packed number mask, size your bet, and let the Keno module execute against the current release snapshot.",
    detailDescription:
      "Use the packed-mask Keno form, preview the stake and fee requirements, and place the bet via the same standardized Hub flow used across the suite.",
    helpLabel: "Packed number selection",
    helpDescription:
      "Keno relies on a uint40-style packed selection. Keep the input valid and use the release metadata as the final authority for routing and encoding expectations.",
  },
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
    }
  );
}
