import assert from "node:assert/strict";
import test from "node:test";
import {
  DRAND_QUICKNET_CHAIN_HASH,
  DRAND_QUICKNET_PUBLIC_KEY,
  fetchQuicknetBeacon,
  quicknetRoundAt,
} from "../src/lib/beacon";

test("deadline unlock time maps to the documented sample round", () => {
  const unlockAt = Date.parse("2024-06-15T12:10:00.000Z") / 1_000;
  assert.equal(quicknetRoundAt(unlockAt), 8_550_012);
});

test("historic quicknet beacon passes pinned chain and BLS verification", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/info")) {
      return Response.json({
        public_key: DRAND_QUICKNET_PUBLIC_KEY,
        period: 3,
        genesis_time: 1692803367,
        hash: DRAND_QUICKNET_CHAIN_HASH,
        groupHash:
          "f477d5c89f21a17c863a7f937c6a6d15859414d2be09cd448d4279af331c5d3e",
        schemeID: "bls-unchained-g1-rfc9380",
        metadata: { beaconID: "quicknet" },
      });
    }
    if (url.includes("/public/8550012")) {
      return Response.json({
        round: 8_550_012,
        randomness:
          "f876d09fc9438e7d53dafb9bd1f2f3c78fe4e85ad9d272e1f979aa572247fb7a",
        signature:
          "88f87a10205ed031a3ae1eec64c4780c9aa787a679788b6259d0b973ea061d612c6bfb395eafacc788feeb5be11b2f18",
      });
    }
    return new Response("not found", { status: 404 });
  };

  try {
    const beacon = await fetchQuicknetBeacon(8_550_012, {
      attempts: 1,
      delayMs: 0,
      timeoutMs: 5_000,
    });
    assert.deepEqual(beacon, {
      round: 8_550_012,
      randomness:
        "f876d09fc9438e7d53dafb9bd1f2f3c78fe4e85ad9d272e1f979aa572247fb7a",
      signature:
        "88f87a10205ed031a3ae1eec64c4780c9aa787a679788b6259d0b973ea061d612c6bfb395eafacc788feeb5be11b2f18",
      verified: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
