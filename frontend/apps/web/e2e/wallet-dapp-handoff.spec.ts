import { devices, expect, test } from "@playwright/test";

// This verifies browser navigation intent with the real RainbowKit selector.
// It does NOT certify iOS/Android installation, app launch or injected accounts.
const origin = "https://wallet-entry.test";
const wallets = [
  ["metaMask", "metamask:"],
  ["trust", "trust:"],
  ["rainbow", "rainbow:"],
  ["okx", "okx:"],
  ["coinbase", "https:"]
] as const;

for (const device of ["iPhone 13", "Pixel 7"]) {
  test.describe(`DApp handoff (${device} emulation)`, () => {
    const { defaultBrowserType: _browser, ...options } = devices[device]!;
    test.use(options);
    test.afterEach(async ({ context }) => {
      await context.unrouteAll({ behavior: "ignoreErrors" });
    });

    for (const [id, scheme] of wallets) {
      test(`${id} opens the current DApp without waiting for a relay`, async ({
        page,
        context,
        baseURL
      }) => {
        await context.route("**/*", (route) => route.abort());
        // Serve our local build at an isolated HTTPS test origin. Production
        // links require HTTPS, and no public website is changed or contacted.
        await context.route(`${origin}/**`, async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          if (request.method() !== "GET") return route.abort();
          const response = await context.request.get(`${baseURL}${url.pathname}${url.search}`, {
            headers: { "accept-language": "en-US", cookie: "arbi-locale=en" }
          });
          await route.fulfill({ response });
        });
        await context.route(/https:\/\/.*(?:walletconnect|reown|metamask\.io)/, (route) =>
          route.abort()
        );
        await context.route("https://go.cb-w.com/**", (route) =>
          route.fulfill({ status: 200, body: "Wallet handoff captured" })
        );
        await page.addInitScript(() => {
          localStorage.setItem("arbigamefi.compliance.age.v1", "true");
          localStorage.setItem(
            "arbigamefi.compliance.terms.v1",
            JSON.stringify({ version: "2026-05-28", acceptedAt: Date.now() })
          );
          localStorage.setItem("arbigamefi.compliance.cookies.v1", '"rejected"');
        });
        const navigations: string[] = [];
        const cdp = await context.newCDPSession(page);
        await cdp.send("Page.enable");
        cdp.on("Page.frameRequestedNavigation", ({ url }) => {
          if (/^(metamask:|trust:|rainbow:|okx:|https:\/\/go\.cb-w\.com\/dapp)/.test(url))
            navigations.push(url);
        });
        await page.goto(`${origin}/casino?ref=a%2Bb&chainId=84532#games`);
        await page.getByRole("button", { name: "Connect", exact: true }).first().click();
        await expect(page.getByTestId("wallet-dapp-handoff")).toBeVisible();
        await page.getByTestId(`rk-wallet-option-${id}`).click({ noWaitAfter: true });
        await expect.poll(() => navigations.length).toBe(1);
        const link = new URL(navigations[0]!);
        expect(link.protocol).toBe(scheme);
        const target =
          id === "metaMask"
            ? navigations[0]!.replace("metamask://dapp/", "https://")
            : link.searchParams.get(
                id === "okx" ? "dappUrl" : id === "coinbase" ? "cb_url" : "url"
              );
        expect(target).toBe(`${origin}/casino?ref=a%2Bb&chainId=84532#games`);
        if (id !== "coinbase") {
          await expect(page.getByRole("link", { name: "Open wallet again" })).toHaveAttribute(
            "href",
            navigations[0]!
          );
          await expect(page.getByRole("link", { name: "Download wallet" })).toBeVisible();
          await expect(page.getByRole("dialog")).toHaveCount(1);
          if (
            id === "metaMask" &&
            device === "iPhone 13" &&
            process.env.WALLET_HANDOFF_SCREENSHOT
          ) {
            await page.screenshot({ path: process.env.WALLET_HANDOFF_SCREENSHOT });
          }
        }
      });
    }
  });
}
