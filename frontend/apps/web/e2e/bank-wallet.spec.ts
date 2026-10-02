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
const { BankAbi } = getContractAbis();
const rpc = process.env.BANK_ANVIL_RPC;
test.skip(!rpc, "Run the isolated Bank browser gate, not the deployment smoke suite");
test("connected wallet deposits, cancels, activates and claims actual cash", async ({
  page,
  context,
  baseURL
}) => {
  const state = JSON.parse(readFileSync(process.env.BANK_E2E_STATE!, "utf8")) as {
    owner: Address;
    bank: Address;
    token: Address;
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
    await client.readContract({ address: state.bank, abi: BankAbi, functionName: "totalSupply" })
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
  await expect(page.getByRole("button", { name: "Deposit assets", exact: true })).toBeDisabled();
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
    await client.readContract({ address: state.bank, abi: BankAbi, functionName: "totalSupply" })
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
    client.readContract({ address: state.bank, abi: BankAbi, functionName, args });
  await expect.poll(() => read("balanceOf", [state.owner]), { timeout: 40_000 }).toBe(100_000_000n);
  await expect(page.getByText("Deposited 100 LOCAL", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  await expect(page.getByText("Wallet: 100 shares", { exact: true })).toBeVisible();
  await page.locator("#earn-request-shares").fill("40");
  await page.getByRole("button", { name: "Request redemption", exact: true }).click();
  await expect.poll(() => read("pendingRedeemRequest", [0n, state.owner])).toBe(40_000_000n);
  await page.getByRole("button", { name: "Cancel queued shares", exact: true }).click();
  await expect.poll(() => read("balanceOf", [state.owner])).toBe(100_000_000n);
  await page.locator("#earn-request-shares").fill("40");
  await page.getByRole("button", { name: "Request redemption", exact: true }).click();
  await expect.poll(() => read("pendingRedeemRequest", [0n, state.owner])).toBe(40_000_000n);
  const batch = (await read("redeemBatch", [1n])) as { cutoff: bigint };
  await evm.setNextBlockTimestamp({ timestamp: batch.cutoff });
  const hash = await wallet.writeContract({
    account: state.owner,
    address: state.bank,
    abi: BankAbi,
    functionName: "activateBatch"
  });
  expect((await client.waitForTransactionReceipt({ hash })).status).toBe("success");
  expect(await page.evaluate(() => (window as any).bankTestWallet.calls.length)).toBe(6);
  const approvals = await page.evaluate(() => (window as any).bankTestWallet.calls.slice(0, 2));
  for (const approval of approvals) {
    expect(approval.params[0].from.toLowerCase()).toBe(state.owner.toLowerCase());
    expect(approval.params[0].to.toLowerCase()).toBe(state.token.toLowerCase());
    expect(approval.params[0].data.slice(0, 10)).toBe("0x095ea7b3");
  }
  await page.reload();
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  await page.getByRole("button", { name: "Claim all exit assets", exact: true }).click();
  await expect(page.getByText("Exit claim confirmed.", { exact: true })).toBeVisible();
  await expect.poll(() => read("exitPayable"), { timeout: 40_000 }).toBe(0n);
  expect(await read("balanceOf", [state.owner])).toBe(60_000_000n);
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
  ).toBe(940_000_000n);
  // Reload creates a fresh provider observation log; only the exit claim is new.
  expect(await page.evaluate(() => (window as any).bankTestWallet.calls.length)).toBe(1);
  await expect(page.getByText("Net P&L", { exact: true })).toHaveCount(0);
});
