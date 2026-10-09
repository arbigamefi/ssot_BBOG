import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  defineChain,
  http,
  type Address
} from "viem";
import { getContractAbis } from "@ssot/ssot/abis";
const { LiquidityVaultAbi, GameHubAbi, BankAbi, VRFHubAbi } = getContractAbis();
const rpc = process.env.BANK_ANVIL_RPC;
test.skip(!rpc, "Run the isolated Bank browser gate, not the deployment smoke suite");
test("connected wallet LP cash flow and casino approval-to-callback accounting", async ({
  page,
  context,
  baseURL
}, testInfo) => {
  const state = JSON.parse(readFileSync(process.env.BANK_E2E_STATE!, "utf8")) as {
    owner: Address;
    bank: Address;
    vault: Address;
    token: Address;
    hub: Address;
    vrf: Address;
    wrapper: Address;
  };
  const chain = defineChain({
    id: 84532,
    name: "Local",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpc!] } }
  });
  const client = createPublicClient({ chain, transport: http(rpc!), cacheTime: 0 });
  const evm = createTestClient({ chain, transport: http(rpc!), mode: "anvil" });
  const wallet = createWalletClient({ chain, transport: http(rpc!) });
  const ensureConnected = async () => {
    const connect = page.getByRole("button", { name: "Connect Wallet", exact: true }).first();
    const connected = page.getByRole("button", {
      name: new RegExp(`${state.owner.slice(0, 6)}…${state.owner.slice(-4)}`, "i")
    });
    const choice = page.getByRole("button", { name: "Browser Wallet", exact: true });
    const tour = page.getByRole("dialog", { name: "Getting started tour" });
    const skipTour = async () => {
      // The tour overlay intercepts pointer events on everything behind it; dismiss it before clicking.
      if (await tour.isVisible())
        await tour.getByRole("button", { name: "Skip", exact: true }).click();
    };
    await skipTour();
    if (await connect.isVisible()) {
      await connect.click();
      // SSR may show Connect while injected-wallet rehydration completes. The
      // click can therefore reveal the tour rather than a connection chooser.
      await expect
        .poll(async () => (await choice.isVisible()) || (await connected.isVisible()))
        .toBe(true);
      if (await choice.isVisible()) await choice.click();
    }
    await expect(connected).toBeVisible();
    await skipTour();
  };
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  // External services cannot receive transactions or test wallet traffic.
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.origin === baseURL || url.origin === new URL(rpc!).origin
      ? route.continue()
      : route.abort();
  });
  await page.addInitScript(
    ({ rpc, account }) => {
      localStorage.setItem("arbigamefi.compliance.age.v1", "true");
      localStorage.setItem(
        "arbigamefi.compliance.terms.v1",
        JSON.stringify({ version: "2026-05-28", acceptedAt: Date.now() })
      );
      localStorage.setItem("arbigamefi.compliance.cookies.v1", '"rejected"');
      // The onboarding tour mounts after hydration and its overlay intercepts clicks; it is not under test here.
      localStorage.setItem("arbigamefi.onboarding.v1", "done");
      let approved = sessionStorage.getItem("bank-test-connected") === "1";
      let currentAccount = account;
      let currentChain = "0x14a34";
      const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
      let holdNextSend = false;
      let releaseSend: (() => void) | undefined;
      const calls: Array<{ method: string; params?: unknown[] }> = [];
      Object.defineProperty(window, "bankTestWallet", {
        value: {
          switchAccount: (next: string) => {
            currentAccount = next;
            for (const listener of listeners.get("accountsChanged") ?? []) listener([next]);
          },
          switchChain: (next: string) => {
            currentChain = next;
            for (const listener of listeners.get("chainChanged") ?? []) listener(next);
          },
          holdNextSend: () => {
            holdNextSend = true;
          },
          releaseSend: () => releaseSend?.(),
          isSendHeld: () => Boolean(releaseSend),
          calls
        }
      });
      const provider = {
        isMetaMask: true,
        get selectedAddress() {
          return approved ? currentAccount : null;
        },
        isConnected: () => true,
        on: (event: string, listener: (...args: unknown[]) => void) => {
          if (!listeners.has(event)) listeners.set(event, new Set());
          listeners.get(event)!.add(listener);
          return provider;
        },
        removeListener: (event: string, listener: (...args: unknown[]) => void) => {
          listeners.get(event)?.delete(listener);
          return provider;
        },
        request: async ({ method, params }: { method: string; params?: unknown[] }) => {
          if (method === "eth_requestAccounts") {
            approved = true;
            sessionStorage.setItem("bank-test-connected", "1");
            return [currentAccount];
          }
          if (method === "eth_accounts") return approved ? [currentAccount] : [];
          if (method === "wallet_requestPermissions") {
            approved = true;
            sessionStorage.setItem("bank-test-connected", "1");
          }
          if (method === "wallet_requestPermissions" || method === "wallet_getPermissions")
            return approved
              ? [
                  {
                    parentCapability: "eth_accounts",
                    caveats: [{ type: "restrictReturnedAccounts", value: [currentAccount] }]
                  }
                ]
              : [];
          if (method === "eth_chainId") return currentChain;
          if (method === "wallet_switchEthereumChain") {
            currentChain = (params?.[0] as { chainId: string }).chainId;
            for (const listener of listeners.get("chainChanged") ?? []) listener(currentChain);
            return null;
          }
          if (method === "eth_sendTransaction") calls.push({ method, params });
          const response = await fetch(rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] })
          });
          const result = await response.json();
          if (result.error) throw result.error;
          if (method === "eth_sendTransaction" && holdNextSend) {
            holdNextSend = false;
            await new Promise<void>((resolve) => {
              releaseSend = resolve;
            });
            releaseSend = undefined;
          }
          return result.result;
        }
      };
      Object.defineProperty(window, "ethereum", { value: provider });
    },
    { rpc: rpc!, account: state.owner }
  );
  await context.addCookies([{ name: "arbi-locale", value: "en", url: baseURL! }]);
  await page.goto("/earn?chainId=84532");
  await page.getByRole("button", { name: "Connect Wallet", exact: true }).first().click();
  await page.getByRole("button", { name: "Browser Wallet", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Hold the already-issued approval response, then switch the connected account.
  // The approval may mine, but the stale flow must never prompt/send the deposit.
  const [, secondAccount] = await wallet.getAddresses();
  await page.evaluate(() => (window as any).bankTestWallet.holdNextSend());
  await page.locator("#earn-amount").fill("100");
  await page.getByRole("button", { name: "Deposit assets", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).bankTestWallet.isSendHeld()))
    .toBe(true);
  await page.evaluate((next) => (window as any).bankTestWallet.switchAccount(next), secondAccount);
  await expect(
    page.getByRole("button", {
      name: new RegExp(`${secondAccount.slice(0, 6)}…${secondAccount.slice(-4)}`, "i"),
      exact: true
    })
  ).toBeVisible();
  await page.evaluate(() => (window as any).bankTestWallet.releaseSend());
  await expect(
    page
      .getByText("The wallet or network changed. Review the current action before trying again.", {
        exact: true
      })
      .first()
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).bankTestWallet.calls.length)).toBe(1);
  expect(
    await client.readContract({
      address: state.vault,
      abi: LiquidityVaultAbi,
      functionName: "balanceOf",
      args: [state.owner]
    })
  ).toBe(0n);
  await page.evaluate((next) => (window as any).bankTestWallet.switchAccount(next), state.owner);
  await expect(
    page.getByRole("button", {
      name: new RegExp(`${state.owner.slice(0, 6)}…${state.owner.slice(-4)}`, "i")
    })
  ).toBeVisible();
  // A second exact approval is required for 120. Change network while its response
  // is pending: the app must not continue the deposit on the former network.
  await page.evaluate(() => (window as any).bankTestWallet.holdNextSend());
  await page.locator("#earn-amount").fill("120");
  await page.getByRole("button", { name: "Deposit assets", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).bankTestWallet.isSendHeld()))
    .toBe(true);
  await page.evaluate(() => (window as any).bankTestWallet.switchChain("0x2105"));
  await expect(page.getByRole("button", { name: /^(Deposit assets|Executing)$/ })).toBeDisabled();
  await page.evaluate(() => (window as any).bankTestWallet.releaseSend());
  await expect
    .poll(() => page.evaluate(() => (window as any).bankTestWallet.isSendHeld()))
    .toBe(false);
  await expect(
    page
      .getByText("The wallet or network changed. Review the current action before trying again.", {
        exact: true
      })
      .last()
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).bankTestWallet.calls.length)).toBe(2);
  expect(
    await client.readContract({
      address: state.vault,
      abi: LiquidityVaultAbi,
      functionName: "balanceOf",
      args: [state.owner]
    })
  ).toBe(0n);
  await page
    .getByRole("button", {
      name: new RegExp(`${state.owner.slice(0, 6)}…${state.owner.slice(-4)}`, "i")
    })
    .click();
  await page.getByRole("button", { name: "Switch wallet", exact: true }).click();
  await page.keyboard.press("Escape");
  // A fresh user action under the restored account consumes the existing exact allowance.
  await page.locator("#earn-amount").fill("100");
  await page.getByRole("button", { name: "Deposit assets", exact: true }).click();
  const read = (functionName: string, args: readonly unknown[] = []) =>
    client.readContract({ address: state.vault, abi: LiquidityVaultAbi, functionName, args });
  await expect.poll(() => read("balanceOf", [state.owner]), { timeout: 40_000 }).toBe(1n);
  expect(await read("getReserve")).toBe(100_000_000n);
  await expect(
    page.getByText("Deposit confirmed. A new NFT has its own 24-hour lock.", { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  const id = (await read("tokenOfOwnerByIndex", [state.owner, 0n])) as bigint;
  await expect(page.getByRole("radio", { name: new RegExp(`NFT #${id}`) })).toBeVisible();
  await expect(page.getByRole("button", { name: "Withdraw now", exact: true })).toBeDisabled();
  while (await page.getByRole("button", { name: "Dismiss notification" }).count()) {
    await page.getByRole("button", { name: "Dismiss notification" }).first().click();
  }
  await page
    .locator("#earn-actions")
    .screenshot({ path: testInfo.outputPath("nft-locked-desktop.png") });
  const mature = (await read("withdrawAfter", [id])) as bigint;
  await evm.setNextBlockTimestamp({ timestamp: mature });
  await evm.mine({ blocks: 1 });
  await page.getByRole("button", { name: "Refresh on-chain state", exact: true }).click();
  await page.locator("#earn-withdraw-percent").fill("40");
  await expect(page.getByRole("button", { name: "Withdraw now", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Withdraw now", exact: true }).click();
  await expect.poll(() => read("getReserve")).toBe(60_000_000n);
  await expect(
    page.getByText("Withdrawal confirmed. Refreshing the remaining capital.", { exact: true })
  ).toBeVisible();
  expect(await read("balanceOf", [state.owner])).toBe(1n);
  const relocked = (await read("withdrawAfter", [id])) as bigint;
  expect(relocked).toBeGreaterThanOrEqual(mature + 86_400n);
  await expect(page.getByRole("button", { name: "Withdraw now", exact: true })).toBeDisabled();
  while (await page.getByRole("button", { name: "Dismiss notification" }).count()) {
    await page.getByRole("button", { name: "Dismiss notification" }).first().click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#earn-actions").scrollIntoViewIfNeeded();
  await page
    .locator("#earn-actions")
    .screenshot({ path: testInfo.outputPath("nft-partial-relocked-mobile.png") });
  await page.setViewportSize({ width: 1280, height: 720 });
  const approvals = await page.evaluate(() => (window as any).bankTestWallet.calls.slice(0, 2));
  for (const approval of approvals) {
    expect(approval.params[0].from.toLowerCase()).toBe(state.owner.toLowerCase());
    expect(approval.params[0].to.toLowerCase()).toBe(state.token.toLowerCase());
    expect(approval.params[0].data.slice(0, 10)).toBe("0x095ea7b3");
    expect(`0x${approval.params[0].data.slice(34, 74)}`).toBe(state.vault.toLowerCase());
  }

  // The withdrawn 40 LOCAL no longer backs new bets. Use the production casino
  // screen, SDK and wallet pipeline against the remaining 60 LOCAL, b=6000.
  await page.goto("/casino/coin-toss?chainId=84532");
  await ensureConnected();
  const amount = page.getByRole("textbox", { name: "Bet amount", exact: true }).first();
  const rolls = page.getByRole("textbox", { name: "Roll count", exact: true });
  await expect(amount).toBeVisible();
  await rolls.fill("25");
  await page.getByRole("button", { name: "Max", exact: true }).click();
  await expect(amount).toHaveValue("0.6");
  await expect(
    page.getByRole("definition").filter({ hasText: "0.6 LOCAL per round · 15 LOCAL total" })
  ).toBeVisible();
  await amount.fill("0.01");
  await expect(page.getByText("Total: 0.25 LOCAL", { exact: true })).toBeVisible();

  // A real delayed governance change while the approval response is held must
  // not turn the old displayed 200-bps intent into a 250-bps stake transaction.
  const write = async (address: Address, abi: any, functionName: string, args: any[] = []) => {
    const hash = await wallet.writeContract({
      account: state.owner,
      address,
      abi,
      functionName,
      args
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");
    return receipt;
  };
  const readHub = (functionName: string, args: any[] = []) =>
    client.readContract({ address: state.hub, abi: GameHubAbi, functionName, args });
  await expect(page.getByRole("button", { name: "PLACE BET", exact: true })).toBeEnabled();
  await page.evaluate(() => (window as any).bankTestWallet.holdNextSend());
  await page.getByRole("button", { name: "PLACE BET", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).bankTestWallet.isSendHeld()))
    .toBe(true);
  await write(state.hub, GameHubAbi, "queueEdgeChange", [250]);
  const [, activatesAt] = (await readHub("pendingEdgeChange")) as readonly [number, bigint];
  await evm.setNextBlockTimestamp({ timestamp: activatesAt });
  await evm.mine({ blocks: 1 });
  await write(state.hub, GameHubAbi, "activateEdgeChange");
  await page.evaluate(() => (window as any).bankTestWallet.releaseSend());
  await expect
    .poll(() => page.evaluate(() => (window as any).bankTestWallet.isSendHeld()))
    .toBe(false);
  await expect(
    page.getByRole("button", { name: "Check settings and continue", exact: true })
  ).toBeVisible();
  expect(await readHub("nextPositionIdHint")).toBe(1n);
  const approvalOnly = await page.evaluate(() => (window as any).bankTestWallet.calls.slice(-1)[0]);
  expect(approvalOnly.params[0].to.toLowerCase()).toBe(state.token.toLowerCase());
  expect(`0x${approvalOnly.params[0].data.slice(34, 74)}`).toBe(state.hub.toLowerCase());

  // A fresh intent accepts the live fee. It reuses only the exact token approval,
  // places 25 x .01, and is completed by one authenticated wrapper callback.
  await page.reload();
  await ensureConnected();
  await page.getByRole("textbox", { name: "Roll count", exact: true }).fill("25");
  await amount.fill("0.01");
  await expect(page.getByRole("button", { name: "PLACE BET", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "PLACE BET", exact: true }).click();
  await expect.poll(() => readHub("nextPositionIdHint"), { timeout: 40_000 }).toBe(2n);
  const bet = (await readHub("getBet", [1n])) as any;
  expect(bet.stake).toBe(250_000n);
  expect(bet.houseEdgeBps).toBe(250);
  expect(bet.betCount).toBe(25);
  const wrapperAbi = JSON.parse(
    readFileSync(
      new URL(
        "../../../../out/MockVRFV2PlusWrapper.sol/MockVRFV2PlusWrapper.json",
        import.meta.url
      ),
      "utf8"
    )
  ).abi;
  const delivered = await write(state.wrapper, wrapperAbi, "fulfillTo", [
    state.vrf,
    bet.requestId,
    [12345n]
  ]);
  expect(((await readHub("getBet", [1n])) as any).state).toBe(4);
  const terminal = (await readHub("getBetTerminal", [1n])) as any;
  const s = (await client.readContract({
    address: state.bank,
    abi: BankAbi,
    functionName: "getSSOT"
  })) as any;
  expect(s.accountingValid).toBe(true);
  expect(s.P + s.R + s.K + s.XP + s.PP).toBe(0n);
  expect(s.PF).toBe(3_125n);
  expect(s.bankCash).toBe(s.PF);
  expect(s.vaultCash).toBe(s.L);
  expect(s.L).toBe(60_000_000n + 250_000n - terminal.payoutNet - s.PF);
  expect(
    await client.readContract({
      address: state.vrf,
      abi: VRFHubAbi,
      functionName: "unbookedResultCount",
      args: [state.bank]
    })
  ).toBe(0n);
  // Terminal events must belong to the wrapper receipt, with no later finalizer tx.
  const terminals = await client.getContractEvents({
    address: state.hub,
    abi: GameHubAbi,
    eventName: "BetFinalized",
    fromBlock: delivered.blockNumber,
    toBlock: delivered.blockNumber
  });
  expect(terminals).toHaveLength(1);
  expect(terminals[0].transactionHash).toBe(delivered.transactionHash);
  const result = page.getByRole("dialog", { name: "Bet details", exact: true });
  await expect(
    result.getByText("The round settled on-chain. See the transfer status below.", {
      exact: true
    })
  ).toBeVisible({ timeout: 40_000 });
  await page.screenshot({ path: testInfo.outputPath("casino-terminal-desktop.png") });
  await result.getByRole("button", { name: "Close", exact: true }).last().click();
  await expect(result).toHaveCount(0);
  expect(await readHub("nextPositionIdHint")).toBe(2n);
  await page.goto("/earn?chainId=84532");
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  expect(await read("withdrawAfter", [id])).toBe(relocked);
  const latest = await client.getBlock();
  await evm.setNextBlockTimestamp({
    timestamp: latest.timestamp + 1n > relocked ? latest.timestamp + 1n : relocked
  });
  await evm.mine({ blocks: 1 });
  await page.getByRole("button", { name: "Refresh on-chain state", exact: true }).click();
  await page.locator("#earn-withdraw-percent").fill("100");
  await expect(page.getByRole("button", { name: "Withdraw now", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Withdraw now", exact: true }).click();
  await expect.poll(() => read("balanceOf", [state.owner])).toBe(0n);
  expect(await read("getReserve")).toBe(0n);
  const erc20 = [
    {
      type: "function",
      name: "balanceOf",
      stateMutability: "view",
      inputs: [{ name: "owner", type: "address" }],
      outputs: [{ type: "uint256" }]
    }
  ] as const;
  expect(
    await client.readContract({
      address: state.token,
      abi: erc20,
      functionName: "balanceOf",
      args: [state.owner]
    })
  ).toBe(1_000_000_000n - 3_125n);
  await expect(page.getByText("Net P&L", { exact: true })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
