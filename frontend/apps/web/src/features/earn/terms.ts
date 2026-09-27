import { lpsKeepHouseEdgeShare } from "@ssot/ssot/release";

import { useOptionalRelease } from "../../ssot/release/ReleaseProvider";

/**
 * Whether the active release lets LPs keep half of each settled bet's house edge (v1.6). The Earn
 * copy states the pool's terms, which differ by release line; outside a ReleaseProvider it states
 * the v1.5 terms.
 */
export function useLpsKeepHouseEdgeShare() {
  return lpsKeepHouseEdgeShare(useOptionalRelease()?.release);
}
