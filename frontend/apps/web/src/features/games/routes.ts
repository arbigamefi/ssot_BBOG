export function getPrimaryGameHref(slug: string) {
  switch (slug) {
    case "coin-toss":
      return "/games/coin-toss";
    case "dice":
    case "roulette":
    case "keno":
      return `/games/${slug}`;
    default:
      return `/games/${slug}`;
  }
}
