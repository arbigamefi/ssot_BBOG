export function getPrimaryGameHref(slug: string) {
  switch (slug) {
    case "coin-toss":
      return "/cointoss";
    case "dice":
    case "roulette":
    case "keno":
      return `/${slug}`;
    default:
      return `/games/${slug}`;
  }
}
