export function getPrimaryGameHref(slug: string) {
  switch (slug) {
    case "coin-toss":
      return "/casino/coin-toss";
    case "dice":
    case "roulette":
    case "keno":
      return `/casino/${slug}`;
    default:
      return `/casino/${slug}`;
  }
}
