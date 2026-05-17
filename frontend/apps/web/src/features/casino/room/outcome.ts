import type { DomainBet } from "@ssot/ssot";
import { deriveCasinoOutcome, type CasinoOutcome } from "@ssot/ssot/domain";
import type { SSOTGameHubAPI } from "@ssot/ssot/sdk";

export type { CasinoOutcome };
export { deriveCasinoOutcome };

export async function readCasinoOutcome({
  gameHub,
  bet,
  gameSlug
}: {
  gameHub: Pick<SSOTGameHubAPI, "getBetParams" | "getBetRandomWords"> | undefined;
  bet: DomainBet | undefined;
  gameSlug: string | undefined;
}): Promise<CasinoOutcome | null> {
  if (!gameHub || !bet || !gameSlug || bet.state !== "finalized") return null;

  try {
    const [params, randomWords] = await Promise.all([
      gameHub.getBetParams(bet.betId),
      gameHub.getBetRandomWords(bet.betId)
    ]);
    return deriveCasinoOutcome({ bet, params, randomWords, gameSlug });
  } catch {
    return null;
  }
}
