export type GamePresentation = {
  icon: string;
  listDescription: string;
  detailDescription: string;
  helpLabel: string;
  helpDescription: string;
  roomLabel: string;
  roomSummary: string;
  playbook: string[];
  theme: {
    badgeClassName: string;
    ambientClassName: string;
    stageClassName: string;
    accentClassName: string;
  };
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
    roomLabel: "Precision room",
    roomSummary: "Dial the cap, track the room pulse, and ship a release-routed dice flow with explicit tolerance bounds.",
    playbook: [
      "Tune the cap to shape your risk curve before you ever sign a transaction.",
      "Plan first to quote VRF fee, stake, and approval requirements against the active release.",
      "Watch the live table after submission so your betId and state transition stay auditable.",
    ],
    theme: {
      badgeClassName: "border-sky-400/30 bg-sky-400/10 text-sky-100",
      ambientClassName:
        "bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.18),transparent_30%)]",
      stageClassName:
        "bg-[linear-gradient(140deg,rgba(2,6,23,0.96),rgba(15,23,42,0.86)),radial-gradient(circle_at_top,rgba(56,189,248,0.20),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.18),transparent_40%)]",
      accentClassName: "text-sky-200",
    },
  },
  "coin-toss": {
    icon: "🪙",
    listDescription: "Heads or tails with the simplest possible parameter model and the same on-chain execution guarantees.",
    detailDescription:
      "Select heads or tails, review the plan, and place a release-routed coin toss bet with fully on-chain settlement and VRF-backed randomness.",
    helpLabel: "Binary outcome flow",
    helpDescription:
      "Coin Toss uses a single boolean parameter. It is the cleanest room for validating allowance, VRF fee, and stepper behavior without extra game-shape complexity.",
    roomLabel: "Binary room",
    roomSummary: "Fastest path from choice to settlement. One switch, one plan, one on-chain outcome.",
    playbook: [
      "Choose a side and use the preview to verify the exact cost of entering the room.",
      "Keep stake sizing disciplined because the UI is intentionally minimal and fast-moving.",
      "Use the recent activity table to inspect how this room is resolving in the current release.",
    ],
    theme: {
      badgeClassName: "border-amber-400/30 bg-amber-400/10 text-amber-100",
      ambientClassName:
        "bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.18),transparent_30%)]",
      stageClassName:
        "bg-[linear-gradient(140deg,rgba(12,10,9,0.96),rgba(41,24,12,0.86)),radial-gradient(circle_at_top,rgba(251,191,36,0.20),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.18),transparent_40%)]",
      accentClassName: "text-amber-200",
    },
  },
  roulette: {
    icon: "🎯",
    listDescription: "Compose a legacy roulette mask, inspect the encoded selection, and send the bet through the current release manifest.",
    detailDescription:
      "Build a roulette mask, confirm the encoded payload shape, and place the bet against the module address defined by the active release bundle.",
    helpLabel: "Legacy mask selection",
    helpDescription:
      "Roulette currently encodes selections as a uint40-compatible mask. Review the release-provided params encoding on every environment because the UI must follow the active manifest, not page-local assumptions.",
    roomLabel: "Mask table",
    roomSummary: "A denser control surface for players who want to build selections instead of pressing a single binary toggle.",
    playbook: [
      "Compose the legacy mask carefully because encoding shape must match the active release manifest.",
      "Use plan preview to verify that your selection, tolerance, and stake bundle are coherent before execution.",
      "Lean on explorer links and room facts when auditing any unexpected settlement path.",
    ],
    theme: {
      badgeClassName: "border-rose-400/30 bg-rose-400/10 text-rose-100",
      ambientClassName:
        "bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(190,24,93,0.18),transparent_30%)]",
      stageClassName:
        "bg-[linear-gradient(140deg,rgba(15,23,42,0.96),rgba(58,11,35,0.86)),radial-gradient(circle_at_top,rgba(244,63,94,0.20),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(190,24,93,0.18),transparent_40%)]",
      accentClassName: "text-rose-200",
    },
  },
  keno: {
    icon: "🔢",
    listDescription: "Pick a packed number mask, size your bet, and let the Keno module execute against the current release snapshot.",
    detailDescription:
      "Use the packed-mask Keno form, preview the stake and fee requirements, and place the bet via the same standardized Hub flow used across the suite.",
    helpLabel: "Packed number selection",
    helpDescription:
      "Keno relies on a uint40-style packed selection. Keep the input valid and use the release metadata as the final authority for routing and encoding expectations.",
    roomLabel: "Matrix room",
    roomSummary: "Number-picking room built for repeatable packed-mask flows and quick auditability after each draw.",
    playbook: [
      "Build a valid packed selection and keep the mask non-zero before planning.",
      "Review VRF fee and stake totals because multi-bet flows can compound faster here.",
      "Use the room table after mining to confirm the state machine reconciles cleanly.",
    ],
    theme: {
      badgeClassName: "border-violet-400/30 bg-violet-400/10 text-violet-100",
      ambientClassName:
        "bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_30%)]",
      stageClassName:
        "bg-[linear-gradient(140deg,rgba(15,23,42,0.96),rgba(29,16,61,0.86)),radial-gradient(circle_at_top,rgba(168,85,247,0.20),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_40%)]",
      accentClassName: "text-violet-200",
    },
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
      roomLabel: "Release room",
      roomSummary: "Governed presentation on top of release-routed execution, with local facts keeping the room auditable.",
      playbook: [
        "Configure the game-specific params using the release-bound form for this route.",
        "Plan before execution so stake, approval, and VRF fee are explicit.",
        "Use recent activity and explorer links to verify the room is behaving as expected.",
      ],
      theme: {
        badgeClassName: "border-slate-400/30 bg-slate-400/10 text-slate-100",
        ambientClassName:
          "bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(100,116,139,0.16),transparent_30%)]",
        stageClassName:
          "bg-[linear-gradient(140deg,rgba(2,6,23,0.96),rgba(15,23,42,0.86)),radial-gradient(circle_at_top,rgba(148,163,184,0.16),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(100,116,139,0.14),transparent_40%)]",
        accentClassName: "text-slate-200",
      },
    }
  );
}
