export type SportsbookProviderOutcomeSide = "home" | "draw" | "away";

export interface SportsbookProviderOutcome {
  outcomeId: number;
  side: SportsbookProviderOutcomeSide;
  name: string;
  decimalPrice: string;
}

export interface SportsbookProviderOdds {
  schemaVersion: "sportsbook.provider-odds.v1";
  provider: {
    name: "the-odds-api";
    sportKey: string;
    providerEventId: string;
    bookmakerKey?: string;
    bookmakerTitle?: string;
    marketLastUpdate?: string;
  };
  event: {
    homeTeam: string;
    awayTeam: string;
    commenceTime?: string;
  };
  outcomes: SportsbookProviderOutcome[];
}

export function providerOutcomeById(odds: SportsbookProviderOdds | undefined, outcomeId: number) {
  return odds?.outcomes.find((item) => item.outcomeId === outcomeId);
}

export function isSportsbookProviderOdds(value: unknown): value is SportsbookProviderOdds {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SportsbookProviderOdds>;
  return (
    candidate.schemaVersion === "sportsbook.provider-odds.v1" &&
    Boolean(candidate.provider) &&
    candidate.provider?.name === "the-odds-api" &&
    typeof candidate.provider?.sportKey === "string" &&
    typeof candidate.provider?.providerEventId === "string" &&
    Boolean(candidate.event) &&
    typeof candidate.event?.homeTeam === "string" &&
    typeof candidate.event?.awayTeam === "string" &&
    Array.isArray(candidate.outcomes) &&
    candidate.outcomes.every(
      (outcome) =>
        outcome &&
        typeof outcome.outcomeId === "number" &&
        (outcome.side === "home" || outcome.side === "draw" || outcome.side === "away") &&
        typeof outcome.name === "string" &&
        typeof outcome.decimalPrice === "string"
    )
  );
}
