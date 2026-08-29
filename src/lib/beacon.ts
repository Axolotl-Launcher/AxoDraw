import {
  fetchBeacon,
  HttpCachingChain,
  HttpChainClient,
  type ChainOptions,
} from "drand-client";

/** Pinned League of Entropy quicknet identity and timing parameters. */
export const DRAND_QUICKNET_CHAIN_HASH =
  "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
export const DRAND_QUICKNET_PUBLIC_KEY =
  "83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a";
export const DRAND_QUICKNET_GENESIS = 1692803367;
export const DRAND_QUICKNET_PERIOD = 3;

const DRAND_API_HOSTS = [
  "https://api.drand.sh",
  "https://api2.drand.sh",
  "https://api3.drand.sh",
];

const chainOptions: ChainOptions = {
  disableBeaconVerification: false,
  noCache: true,
  chainVerificationParams: {
    chainHash: DRAND_QUICKNET_CHAIN_HASH,
    publicKey: DRAND_QUICKNET_PUBLIC_KEY,
  },
};

const clients = DRAND_API_HOSTS.map((host) => {
  const chainUrl = `${host}/${DRAND_QUICKNET_CHAIN_HASH}`;
  const chain = new HttpCachingChain(chainUrl, chainOptions);
  return new HttpChainClient(chain, chainOptions);
});

export type QuicknetBeacon = {
  round: number;
  randomness: string;
  signature: string;
  /** Set only after drand-client has checked the pinned chain and BLS signature. */
  verified: true;
};

// Beacon rounds are immutable. Cache a bounded number so public verification
// does not repeatedly hit drand or redo pairings for the same popular draw.
const verifiedBeaconCache = new Map<number, QuicknetBeacon>();
const MAX_CACHED_BEACONS = 512;

export class BeaconUnavailableError extends Error {
  readonly round: number;

  constructor(round: number, reason: string) {
    super(reason);
    this.name = "BeaconUnavailableError";
    this.round = round;
  }
}

/** 计算某一秒对应的 quicknet 轮次（轮次 N 起始于 genesis + (N-1) * 3 秒）。 */
export function quicknetRoundAt(unixSeconds: number): number {
  if (!Number.isFinite(unixSeconds)) throw new Error("时间必须是有限数值");
  return (
    Math.floor((unixSeconds - DRAND_QUICKNET_GENESIS) / DRAND_QUICKNET_PERIOD) + 1
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("drand 请求超时")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/**
 * Fetches one exact quicknet round and verifies all trust-bearing fields:
 * - the relay's chain hash and public key match the pinned quicknet identity;
 * - the response round equals the requested round;
 * - randomness equals SHA-256(signature);
 * - the RFC 9380 BLS signature is valid for that round.
 */
export async function fetchQuicknetBeacon(
  round: number,
  options: { attempts?: number; delayMs?: number; timeoutMs?: number } = {},
): Promise<QuicknetBeacon> {
  if (!Number.isSafeInteger(round) || round < 1) {
    throw new BeaconUnavailableError(round, "信标轮次无效");
  }
  const cached = verifiedBeaconCache.get(round);
  if (cached) return cached;
  const attempts = Math.max(1, options.attempts ?? 5);
  const delayMs = Math.max(0, options.delayMs ?? 1_000);
  const timeoutMs = Math.max(1, options.timeoutMs ?? 8_000);
  let lastReason = "信标不可用";

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const client = clients[attempt % clients.length];
    try {
      // fetchBeacon performs the pinned chain-info, exact-round, randomness,
      // and cryptographic signature checks when verification is enabled.
      const beacon = await withTimeout(fetchBeacon(client, round), timeoutMs);
      if (beacon.round !== round) throw new Error("信标返回了错误轮次");
      const verified = {
        round: beacon.round,
        randomness: beacon.randomness,
        signature: beacon.signature,
        verified: true as const,
      };
      verifiedBeaconCache.set(round, verified);
      if (verifiedBeaconCache.size > MAX_CACHED_BEACONS) {
        const oldest = verifiedBeaconCache.keys().next().value;
        if (oldest !== undefined) verifiedBeaconCache.delete(oldest);
      }
      return verified;
    } catch (cause) {
      lastReason = cause instanceof Error ? cause.message : "信标验证失败";
    }
    if (attempt + 1 < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new BeaconUnavailableError(round, lastReason);
}
