import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "../../og/render";

export const alt = "ArbiGameFi — system status";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Status / transparency card — shareable trust signal for the public status page.
export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "System status",
    title: "Trust, visible in real time.",
    subtitle: "Keeper health, settlement latency, and index freshness — in the open.",
    badge: "Transparency",
    stat: "Live",
    tone: "muted",
    visualKind: "status",
    variant: "utility",
    metrics: [
      { label: "Keeper", value: "Monitored" },
      { label: "Settlement", value: "Tracked" },
      { label: "Index", value: "Live" }
    ],
    footerItems: ["Live status", "Public metrics", "Verifiable on-chain"]
  });
}
