import type { Meta, StoryObj } from "@storybook/react";

import { GameCard } from "../components/ui/game-card";

const meta: Meta<typeof GameCard> = {
  title: "Navigation/GameCard",
  component: GameCard,
  parameters: {
    layout: "centered"
  },
  args: {
    colorVariant: "blue",
    title: "Dice",
    promise: "Set a cap, size your stake, and move into a fast room entry flow.",
    icon: <div className="text-7xl">🎲</div>,
    tag: "Precision Room",
    liveStatus: "LIVE",
    href: "/dice",
    buttonText: "Open live room"
  }
};

export default meta;

type Story = StoryObj<typeof GameCard>;

export const Default: Story = {
  args: {}
};

export const ReleaseSuite: Story = {
  render: () => (
    <div className="grid w-[960px] gap-6 sm:grid-cols-2 xl:grid-cols-4">
      <GameCard
        colorVariant="blue"
        title="Dice"
        promise="Cap-driven room with release-routed settlement."
        icon={<div className="text-7xl">🎲</div>}
        tag="Precision Room"
        liveStatus="LIVE"
        href="/dice"
        buttonText="Open live room"
      />
      <GameCard
        colorVariant="amber"
        title="Coin Toss"
        promise="Binary outcome room with the simplest parameter surface."
        icon={<div className="text-7xl">🪙</div>}
        tag="Binary Room"
        liveStatus="LIVE"
        href="/cointoss"
        buttonText="Open live room"
      />
      <GameCard
        colorVariant="rose"
        title="Roulette"
        promise="Standard European roulette room with a cleaner ticket review."
        icon={<div className="text-7xl">🎯</div>}
        tag="European Table"
        liveStatus="LIVE"
        href="/roulette"
        buttonText="Open live room"
      />
      <GameCard
        colorVariant="fuchsia"
        title="Keno"
        promise="Packed number selection with the standard bet flow."
        icon={<div className="text-7xl">🔢</div>}
        tag="Matrix Room"
        liveStatus="LIVE"
        href="/keno"
        buttonText="Open live room"
      />
    </div>
  )
};
