import {
  getSportsbookProviderOdds,
  SportsbookProviderOddsError
} from "../../../../server/sportsbook/provider-odds";

export const dynamic = "force-dynamic";

const SOFT_PROVIDER_FAILURE_CODES = new Set([
  "ODDS_PROVIDER_CONFIG_MISSING",
  "PROVIDER_BAD_RESPONSE",
  "PROVIDER_EVENT_INCOMPLETE",
  "PROVIDER_H2H_MISSING",
  "PROVIDER_OUTCOME_MISSING",
  "PROVIDER_REQUEST_FAILED"
]);

function noStore() {
  return {
    "Cache-Control": "no-store"
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const odds = await getSportsbookProviderOdds({ searchParams: url.searchParams });
    return Response.json(odds, {
      headers: noStore()
    });
  } catch (error) {
    if (error instanceof SportsbookProviderOddsError) {
      if (SOFT_PROVIDER_FAILURE_CODES.has(error.code)) {
        return Response.json(
          {
            schemaVersion: "sportsbook.provider-odds-unavailable.v1",
            unavailable: {
              code: error.code,
              message: error.message
            }
          },
          { headers: noStore() }
        );
      }
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status }
      );
    }
    return Response.json(
      {
        error: {
          code: "PROVIDER_ODDS_FAILED",
          message: error instanceof Error ? error.message : "Provider odds request failed."
        }
      },
      { status: 500 }
    );
  }
}
