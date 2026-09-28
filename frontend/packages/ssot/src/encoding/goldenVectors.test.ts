import fs from "node:fs/promises";
import { describe, it, expect } from "vitest";
import { encodeFunctionData, type Hex } from "viem";
import { encodeStakeSpec } from "./stakeSpec";
import { getContractAbis } from "../abis/index.mjs";
import { requireGameEncoder } from "./registry";

function normalizeHex(value: string): Hex {
  return value.toLowerCase() as Hex;
}

describe("current contract golden vectors", () => {
  it("matches every game encoder, stakeSpec and placeBet calldata exactly", async () => {
    const raw = JSON.parse(
      await fs.readFile(
        new URL("../fixtures/golden-vectors-v16.fixture.json", import.meta.url),
        "utf8"
      )
    );
    const release = JSON.parse(
      await fs.readFile(new URL("../fixtures/release-v16.fixture.json", import.meta.url), "utf8")
    );
    expect(raw.schemaVersion).toBe(2);
    expect(raw.architectureVersion).toBe("v1.6-house-edge-allocation");
    expect(raw.chainId).toBe(release.chainId);
    expect(raw.vectors.length).toBeGreaterThan(0);
    const { GameHubAbi } = getContractAbis();
    const checkedGames = new Set<string>();
    for (const vector of raw.vectors) {
      expect(normalizeHex(vector.gameHub)).toBe(normalizeHex(release.contracts.gameHub));
      const game = release.gamesMeta.find(
        (entry: { gameId: string }) => normalizeHex(entry.gameId) === normalizeHex(vector.gameId)
      );
      expect(game).toBeDefined();
      const encoder = requireGameEncoder(game.slug);
      expect(normalizeHex(encoder.encode(encoder.decode(vector.params)))).toBe(
        normalizeHex(vector.params)
      );
      checkedGames.add(game.gameId.toLowerCase());
      const stakeSpec = {
        amountPerRoll: BigInt(vector.stakeSpec.amountPerRoll),
        betCount: Number(vector.stakeSpec.betCount),
        stopGain: BigInt(vector.stakeSpec.stopGain),
        stopLoss: BigInt(vector.stakeSpec.stopLoss)
      };
      expect(normalizeHex(encodeStakeSpec(stakeSpec))).toBe(normalizeHex(vector.stakeSpecEncoded));
      const calldata = encodeFunctionData({
        abi: GameHubAbi,
        functionName: "placeBet",
        args: [
          normalizeHex(vector.gameId),
          BigInt(vector.poolId),
          normalizeHex(vector.params),
          stakeSpec,
          normalizeHex(vector.affiliate),
          Number(vector.maxHouseEdgeBps)
        ]
      });
      expect(calldata.slice(0, 10)).toBe(normalizeHex(vector.selector));
      expect(calldata).toBe(normalizeHex(vector.placeBetCalldata));
    }
    expect(checkedGames).toEqual(
      new Set(release.gamesMeta.map((game: { gameId: string }) => game.gameId.toLowerCase()))
    );
  });
});
