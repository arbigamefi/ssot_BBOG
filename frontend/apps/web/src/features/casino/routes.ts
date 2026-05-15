import { getCasinoModule } from "./modules";

export function getPrimaryGameHref(slug: string) {
  return getCasinoModule(slug)?.canonicalHref ?? `/casino/${slug}`;
}
