import {
  getSportsbookProviderOdds,
  SportsbookProviderOddsError
} from "../../../../server/sportsbook/provider-odds";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const odds = await getSportsbookProviderOdds({ searchParams: url.searchParams });
    return Response.json(odds, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof SportsbookProviderOddsError) {
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
