import { createHash, createHmac, randomBytes } from "node:crypto";
import type { QuicknetBeacon } from "@/lib/beacon";
import { loadLottery, persistLottery } from "@/lib/supabase";

export const CURRENT_DRAW_ALGORITHM = "deterministic-v2" as const;
export type DrawAlgorithm = "deterministic-v1" | typeof CURRENT_DRAW_ALGORITHM;
export type LotteryStatus = "scheduled" | "drawn";

export type Lottery = {
  code: string;
  title: string;
  description: string;
  deadline: string;
  winnerCount: number;
  duplicatePolicy: "keep" | "dedupe";
  entries: string[];
  status: LotteryStatus;
  winners: string[];
  managementTokenHash: string;
  /**
   * Public snapshot hash of every field that affects the draw. This lets
   * participants save the value before the deadline and detect later changes.
   * It is not, by itself, an external timestamp or transparency log.
   */
  entriesCommitment?: string;
  commitmentUpdatedAt?: string;
  draw?: {
    round: number;
    randomness: string;
    signature: string;
    algorithm: DrawAlgorithm;
    drawnAt: string;
    digest: string;
    entriesCommitment?: string;
  };
};

type PublicLottery = Omit<Lottery, "managementTokenHash"> & {
  managementToken?: string;
};

type NewLotteryInput = Pick<
  Lottery,
  | "title"
  | "description"
  | "deadline"
  | "winnerCount"
  | "duplicatePolicy"
  | "entries"
>;

const store = globalThis as typeof globalThis & {
  __axodraw?: Map<string, Lottery>;
};
const lotteries = store.__axodraw ?? new Map<string, Lottery>();
store.__axodraw = lotteries;

const SAMPLE_CODE = "AXO-7K4M";
const V2_BLOCK_DOMAIN = Buffer.from("axodraw-deterministic-v2\0", "utf8");
const UINT256_SPACE = 1n << 256n;

export function hash(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

/** Canonical, versioned snapshot of every stored field that affects a draw. */
export function computeEntriesCommitment(
  lottery: Pick<
    Lottery,
    | "code"
    | "title"
    | "description"
    | "deadline"
    | "winnerCount"
    | "duplicatePolicy"
    | "entries"
  >,
) {
  const canonical = JSON.stringify({
    version: "axodraw-commitment-v1",
    code: lottery.code,
    title: lottery.title,
    description: lottery.description,
    deadline: lottery.deadline,
    winnerCount: lottery.winnerCount,
    duplicatePolicy: lottery.duplicatePolicy,
    entries: lottery.entries,
  });
  return `sha256:${hash(canonical)}`;
}

export function refreshEntriesCommitment(
  lottery: Lottery,
  updatedAt = new Date().toISOString(),
) {
  lottery.entriesCommitment = computeEntriesCommitment(lottery);
  lottery.commitmentUpdatedAt = updatedAt;
  return lottery.entriesCommitment;
}

function legacyV1Result(lottery: Lottery, randomness: string) {
  const digest = hash(
    [
      randomness,
      lottery.code,
      lottery.entries.join("\n"),
      "deterministic-v1",
    ].join("|"),
  );
  const available = [...lottery.entries];
  let state = BigInt(`0x${digest}`);
  for (let i = available.length - 1; i > 0; i -= 1) {
    state =
      (state * 6364136223846793005n + 1442695040888963407n) &
      (UINT256_SPACE - 1n);
    const j = Number(state % BigInt(i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return {
    digest: `sha256:${digest}`,
    winners: available.slice(0, lottery.winnerCount),
  };
}

/**
 * Generates a domain-separated HMAC block for one rejection-sampling attempt.
 * A fresh counter is used for every block, avoiding the low-bit correlations
 * that made deterministic-v1's LCG shuffle strongly order-biased.
 */
function v2Block(seed: Buffer, counter: bigint) {
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(counter);
  return createHmac("sha256", seed)
    .update(V2_BLOCK_DOMAIN)
    .update(counterBytes)
    .digest();
}

function deterministicV2Result(lottery: Lottery, randomness: string) {
  const commitment = computeEntriesCommitment(lottery);
  const digest = hash(
    [randomness, commitment, CURRENT_DRAW_ALGORITHM].join("|"),
  );
  const seed = Buffer.from(digest, "hex");
  const available = [...lottery.entries];
  let counter = 0n;

  for (let i = available.length - 1; i > 0; i -= 1) {
    const bound = BigInt(i + 1);
    // Reject the short tail so every index has exactly the same number of
    // 256-bit preimages. This removes modulo bias instead of approximating it.
    const limit = UINT256_SPACE - (UINT256_SPACE % bound);
    let sample: bigint;
    do {
      sample = BigInt(`0x${v2Block(seed, counter).toString("hex")}`);
      counter += 1n;
    } while (sample >= limit);
    const j = Number(sample % bound);
    [available[i], available[j]] = [available[j], available[i]];
  }

  return {
    digest: `sha256:${digest}`,
    winners: available.slice(0, lottery.winnerCount),
  };
}

export function computeDrawResult(
  lottery: Lottery,
  randomness: string,
  algorithm: DrawAlgorithm,
) {
  return algorithm === "deterministic-v1"
    ? legacyV1Result(lottery, randomness)
    : deterministicV2Result(lottery, randomness);
}

const sampleBase = {
  code: SAMPLE_CODE,
  title: "示例抽奖（演示数据）",
  description:
    "这是一条用于演示的示例数据，不代表任何真实活动；结果由 drand 公开信标真实生成，可独立核验抽奖方法与结果。",
  deadline: "2024-06-15T12:00:00.000Z",
  winnerCount: 3,
  duplicatePolicy: "keep" as const,
  entries: [
    "service-001",
    "service-002",
    "service-003",
    "service-004",
    "service-005",
  ],
};
const sampleRandomness =
  "f876d09fc9438e7d53dafb9bd1f2f3c78fe4e85ad9d272e1f979aa572247fb7a";
const sampleCommitment = computeEntriesCommitment(sampleBase);
const sampleResult = deterministicV2Result(
  {
    ...sampleBase,
    status: "scheduled",
    winners: [],
    managementTokenHash: "sample",
    entriesCommitment: sampleCommitment,
    commitmentUpdatedAt: "2024-06-15T11:59:59.000Z",
  },
  sampleRandomness,
);

// 示例抽奖：信标来自 quicknet round 8550012；签名、randomness、摘要与
// 名单均由生产路径使用的算法计算，不保留旧版有偏 LCG 的演示结果。
const sampleLottery: Lottery = {
  ...sampleBase,
  status: "drawn",
  winners: sampleResult.winners,
  managementTokenHash: "sample",
  entriesCommitment: sampleCommitment,
  commitmentUpdatedAt: "2024-06-15T11:59:59.000Z",
  draw: {
    round: 8550012,
    randomness: sampleRandomness,
    signature:
      "88f87a10205ed031a3ae1eec64c4780c9aa787a679788b6259d0b973ea061d612c6bfb395eafacc788feeb5be11b2f18",
    algorithm: CURRENT_DRAW_ALGORITHM,
    drawnAt: "2024-06-15T12:10:05.000Z",
    digest: sampleResult.digest,
    entriesCommitment: sampleCommitment,
  },
};

function seedSampleLottery() {
  const existing = lotteries.get(SAMPLE_CODE);
  const legacy =
    existing &&
    (existing.draw?.algorithm !== CURRENT_DRAW_ALGORITHM ||
      existing.draw?.digest !== sampleLottery.draw?.digest);
  if (!existing || legacy) lotteries.set(SAMPLE_CODE, sampleLottery);
}
seedSampleLottery();

export function publicLottery(lottery: Lottery): PublicLottery {
  const { managementTokenHash, ...safe } = lottery;
  void managementTokenHash;
  return safe;
}

export function createLottery(input: NewLotteryInput) {
  // 64 random bits keep accidental collisions negligible even at large scale.
  const code = `AXO-${randomBytes(8).toString("hex").toUpperCase()}`;
  const managementToken = randomBytes(24).toString("base64url");
  const lottery: Lottery = {
    ...input,
    code,
    status: "scheduled",
    winners: [],
    managementTokenHash: hash(managementToken),
  };
  refreshEntriesCommitment(lottery);
  return { lottery, managementToken };
}

export function findLottery(code: string) {
  return lotteries.get(code.toUpperCase());
}

export async function getLottery(code: string) {
  const normalized = code.toUpperCase();
  // Prefer durable storage so separate server instances cannot draw from a
  // stale in-memory copy after another instance updates the participant list.
  const stored = await loadLottery(normalized);
  if (stored) {
    lotteries.set(normalized, stored);
    return stored;
  }
  return lotteries.get(normalized) ?? null;
}

export async function saveLottery(lottery: Lottery) {
  await persistLottery(lottery);
  lotteries.set(lottery.code, lottery);
}

export function verifyToken(lottery: Lottery, token: string) {
  return Boolean(token) && hash(token) === lottery.managementTokenHash;
}

export function drawLottery(lottery: Lottery, beacon: QuicknetBeacon) {
  if (lottery.status === "drawn") return lottery;
  const commitment = computeEntriesCommitment(lottery);
  if (!lottery.entriesCommitment || lottery.entriesCommitment !== commitment) {
    throw new Error("参与值承诺缺失或与当前记录不一致");
  }
  const result = computeDrawResult(
    lottery,
    beacon.randomness,
    CURRENT_DRAW_ALGORITHM,
  );
  lottery.winners = result.winners;
  lottery.status = "drawn";
  lottery.draw = {
    round: beacon.round,
    randomness: beacon.randomness,
    signature: beacon.signature,
    algorithm: CURRENT_DRAW_ALGORITHM,
    drawnAt: new Date().toISOString(),
    digest: result.digest,
    entriesCommitment: commitment,
  };
  return lottery;
}
