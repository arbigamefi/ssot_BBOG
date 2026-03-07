import type { Meta, StoryObj } from "@storybook/react";

import { GameCard } from "../components/ui/game-card";

const meta: Meta<typeof GameCard> = {
  title: "Navigation/GameCard",
  component: GameCard,
  parameters: {
    layout: "centered",
  },
  args: {
    slug: "dice",
    label: "Dice",
    icon: "🎲",
    badge: "Precision Room",
    description: "Set a cap, size your stake, and place a release-routed bet.",
    summary: "Fastest path into a cap-driven on-chain room with explicit plan preview and live table context.",
    facts: ["Release-routed", "Cap-based", "Live room"],
  },
};

export default meta;

type Story = StoryObj<typeof GameCard>;

export const Default: Story = {
  args: {},
};

export const ReleaseSuite: Story = {
  render: () => (
    <div className="grid w-[960px] gap-6 sm:grid-cols-2 xl:grid-cols-4">
      <GameCard
        slug="dice"
        label="Dice"
        icon="🎲"
        badge="Precision Room"
        description="Cap-driven room with release-routed settlement."
        summary="Tune your cap, preview the full cost stack, and inspect the live table after signing."
        facts={["Release-routed", "VRF-backed", "Live facts"]}
      />
      <GameCard
        slug="coin-toss"
        label="Coin Toss"
        icon="🪙"
        badge="Binary Room"
        description="Binary outcome room with the simplest parameter surface."
        summary="One switch, one plan, one on-chain settlement path."
        facts={["Heads / tails", "Fast room", "Wallet-native"]}
      />
      <GameCard
        slug="roulette"
        label="Roulette"
        icon="🎯"
        badge="Mask Table"
        description="Legacy mask selection routed through the active manifest."
        summary="Dense selection surface for players who want more than a binary toggle."
        facts={["Legacy mask", "Manifest-driven", "Explorer-friendly"]}
      />
      <GameCard
        slug="keno"
        label="Keno"
        icon="🔢"
        badge="Matrix Room"
        description="Packed number selection with the standard bet flow."
        summary="Build a packed pick, size the room entry, and keep the result trail auditable."
        facts={["Packed mask", "Repeatable", "Room journal"]}
      />
    </div>
  ),
};
