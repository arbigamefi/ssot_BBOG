// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// eslint-disable-next-line no-restricted-imports -- Local Anvil uses Solidity modules as the independent Max oracle; production UI uses the SDK.
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  defineChain,
  http,
  type Abi,
  type Hex
} from "viem";
import { buildGameParams, calculateGameReserveRatio, type BuildGameParamsInput } from "./params";

// Explicitly opt in to an owned local Anvil. No compilation, remote calls, or production broadcasts.
const rpc = process.env.MODULE_ORACLE_RPC;
if (rpc && (new URL(rpc).hostname !== "127.0.0.1" || new URL(rpc).protocol !== "http:"))
  throw new Error("MODULE_ORACLE_RPC must use isolated local Anvil");
const artifactDir = process.env.MODULE_ORACLE_ARTIFACTS;
const base: BuildGameParamsInput = {
  slug: "dice",
  diceTarget: 50,
  diceDirection: "under",
  coinSide: "HEADS",
  rouletteSpots: [],
  kenoSpots: [],
  plinkoRisk: "medium"
};
const modules: [string, Partial<BuildGameParamsInput>[]][] = [
  [
    "DiceModule",
    ["under", "over"].flatMap((direction) =>
      Array.from({ length: 99 }, (_, i) => ({
        slug: "dice",
        diceTarget: i + 1,
        diceDirection: direction as "under" | "over"
      }))
    )
  ],
  [
    "CoinTossModule",
    [
      { slug: "coin-toss", coinSide: "HEADS" },
      { slug: "coin-toss", coinSide: "TAILS" }
    ]
  ],
  [
    "RouletteModule",
    [
      ...Array.from({ length: 36 }, (_, i) => ({
        slug: "roulette",
        rouletteSpots: Array.from({ length: i + 1 }, (_, n) => String(n))
      })),
      ...[
        "RED",
        "BLACK",
        "ODD",
        "EVEN",
        "1-18",
        "19-36",
        "1st 12",
        "2nd 12",
        "3rd 12",
        "col1",
        "col2",
        "col3"
      ].map((spot) => ({ slug: "roulette", rouletteSpots: [spot] }))
    ]
  ],
  [
    "KenoModule",
    Array.from({ length: 5 }, (_, i) => ({
      slug: "keno",
      kenoSpots: Array.from({ length: i + 1 }, (_, n) => n + 1)
    }))
  ],
  [
    "PlinkoModule",
    (["low", "medium", "high"] as const).map((plinkoRisk) => ({ slug: "plinko", plinkoRisk }))
  ],
  ["SlotsModule", [{ slug: "slots" }]],
  [
    "BaccaratModule",
    (["player", "banker", "tie"] as const).map((baccaratSide) => ({
      slug: "baccarat",
      baccaratSide
    }))
  ],
  [
    "SicBoModule",
    [
      ...(["small", "big", "anyTriple"] as const).map((sicBoKind) => ({
        slug: "sic-bo",
        sicBoKind
      })),
      ...Array.from({ length: 14 }, (_, i) => ({
        slug: "sic-bo",
        sicBoKind: "total" as const,
        sicBoValue: i + 4
      })),
      ...(["specificTriple", "specificDouble", "singleFace"] as const).flatMap((sicBoKind) =>
        Array.from({ length: 6 }, (_, i) => ({ slug: "sic-bo", sicBoKind, sicBoValue: i + 1 }))
      )
    ]
  ]
];

describe.skipIf(!rpc)("exact reserve ratios against deployed Solidity modules", () => {
  it.each(modules)(
    "%s matches all supported parameter classes and stake floors",
    async (name, selections) => {
      if (!artifactDir) throw new Error("MODULE_ORACLE_ARTIFACTS required for frozen artifacts");
      const compiled = JSON.parse(readFileSync(`${artifactDir}/${name}.json`, "utf8")) as {
        abi: Abi;
        bytecode: { object: Hex };
        metadata: string;
      };
      const metadata =
        typeof compiled.metadata === "string" ? JSON.parse(compiled.metadata) : compiled.metadata;
      expect(metadata.compiler.version).toMatch(/^0\.8\.37\+/);
      const chain = defineChain({
        id: 84532,
        name: "Module oracle Anvil",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [rpc!] } }
      });
      const transport = http(rpc!);
      const pub = createPublicClient({ chain, transport, cacheTime: 0, pollingInterval: 10 });
      const wallet = createWalletClient({ chain, transport });
      const evm = createTestClient({ chain, transport, mode: "anvil" });
      expect(await evm.getAutomine()).toBe(true);
      expect(await pub.getChainId()).toBe(84532);
      const [account] = await wallet.getAddresses();
      const hash = await wallet.deployContract({
        account: account!,
        abi: compiled.abi,
        bytecode: compiled.bytecode.object
      });
      const receipt = await pub.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe("success");
      if (!receipt.contractAddress) throw new Error("Missing module deployment");
      let checked = 0;
      for (const selection of selections) {
        const input = { ...base, ...selection };
        const params = buildGameParams(input);
        expect(params.ok).toBe(true);
        if (!params.ok) throw new Error(params.message);
        const ratio = calculateGameReserveRatio(input);
        expect(ratio).toBeDefined();
        // Off-grid amounts force integer floor differences; count 25 is the admitted cap.
        for (const amountPerRoll of [10_001n, 8_174_311_939n])
          for (const betCount of [1, 25]) {
            const spec = { amountPerRoll, betCount, stopGain: 0n, stopLoss: 0n };
            const actual = await pub.readContract({
              address: receipt.contractAddress,
              abi: compiled.abi,
              functionName: "maxPayout",
              args: [params.params, spec]
            });
            expect(actual, JSON.stringify(selection)).toBe(
              (amountPerRoll * BigInt(betCount) * ratio!.numerator) / ratio!.denominator
            );
            checked++;
          }
      }
      console.info(
        `${name}: ${selections.length} parameter classes, ${checked} on-chain maxPayout comparisons`
      );
    },
    60_000
  );
});
