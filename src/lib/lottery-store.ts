import { createHash, randomBytes } from "node:crypto";
import { loadLottery, persistLottery } from "@/lib/supabase";

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
  draw?: {
    round: number;
    randomness: string;
    signature: string;
    algorithm: string;
    drawnAt: string;
    digest: string;
  };
};

type PublicLottery = Omit<Lottery, "managementTokenHash"> & {
  managementToken?: string;
};
const store = globalThis as typeof globalThis & {
  __axodraw?: Map<string, Lottery>;
};
const lotteries = store.__axodraw ?? new Map<string, Lottery>();
store.__axodraw = lotteries;

const SAMPLE_CODE = "AXO-7K4M";

// 示例抽奖：真实数据，可在 https://api.drand.sh/v2/beacons/quicknet/rounds/8550012 核对，
// randomness 按 quicknet(unched) 规范由签名推导，digest 与名单由算法真实计算。
const sampleLottery: Lottery = {
  code: SAMPLE_CODE,
  title: "示例抽奖（演示数据）",
  description: "这是一条用于演示的示例数据，不代表任何真实活动；结果由 drand 公开信标真实生成，可独立核验抽奖方法与结果。",
  deadline: "2024-06-15T12:00:00.000Z",
  winnerCount: 3,
  duplicatePolicy: "keep",
  entries: [
    "service-001",
    "service-002",
    "service-003",
    "service-004",
    "service-005",
  ],
  status: "drawn",
  winners: ["service-003", "service-004", "service-002"],
  managementTokenHash: "sample",
  draw: {
    round: 8550012,
    randomness: "f876d09fc9438e7d53dafb9bd1f2f3c78fe4e85ad9d272e1f979aa572247fb7a",
    signature: "88f87a10205ed031a3ae1eec64c4780c9aa787a679788b6259d0b973ea061d612c6bfb395eafacc788feeb5be11b2f18",
    algorithm: "deterministic-v1",
    drawnAt: "2024-06-15T12:10:05.000Z",
    digest: "sha256:f9e3cba8be88cbe68e6d0c67fcc93a7b308a5ecb939cebec8017e544ddb3ad96",
  },
};

// dev server 内存中的旧版本示例数据（假签名/假轮次）会在热更新后残留，
// 检测到旧数据时自动替换为真实数据，无需重启。
function seedSampleLottery() {
  const existing = lotteries.get(SAMPLE_CODE);
  const legacy =
    existing &&
    (existing.draw?.signature === "sample-signature" ||
      existing.draw?.round === 424242 ||
      String(existing.draw?.digest).includes("sample"));
  if (!existing || legacy) lotteries.set(SAMPLE_CODE, sampleLottery);
}
seedSampleLottery();

export function publicLottery(lottery: Lottery): PublicLottery {
  const { managementTokenHash, ...safe } = lottery;
  void managementTokenHash;
  return safe;
}

export function createLottery(
  input: Omit<Lottery, "code" | "status" | "winners" | "managementTokenHash">,
) {
  const code = `AXO-${randomBytes(3).toString("hex").toUpperCase()}`;
  const managementToken = randomBytes(24).toString("base64url");
  const lottery: Lottery = {
    ...input,
    code,
    status: "scheduled",
    winners: [],
    managementTokenHash: hash(managementToken),
  };
  lotteries.set(code, lottery);
  return { lottery, managementToken };
}

export function findLottery(code: string) {
  return lotteries.get(code.toUpperCase());
}
export async function getLottery(code: string) {
  const normalized = code.toUpperCase();
  const cached = lotteries.get(normalized);
  if (cached) return cached;
  const stored = await loadLottery(normalized);
  if (stored) lotteries.set(normalized, stored);
  return stored ?? null;
}
export async function saveLottery(lottery: Lottery) {
  lotteries.set(lottery.code, lottery);
  await persistLottery(lottery);
}
export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function verifyToken(lottery: Lottery, token: string) {
  return Boolean(token) && hash(token) === lottery.managementTokenHash;
}

export function drawLottery(
  lottery: Lottery,
  randomness: string,
  signature: string,
  round: number,
) {
  if (lottery.status === "drawn") return lottery;
  const digest = hash(
    [
      randomness,
      lottery.code,
      lottery.entries.join("\n"),
      "deterministic-v1",
    ].join("|"),
  );
  const available = lottery.entries.map((value, index) => ({ value, index }));
  let state = BigInt(`0x${digest}`);
  for (let i = available.length - 1; i > 0; i -= 1) {
    state =
      (state * 6364136223846793005n + 1442695040888963407n) &
      ((1n << 256n) - 1n);
    const j = Number(state % BigInt(i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  lottery.winners = available
    .slice(0, lottery.winnerCount)
    .map((entry) => entry.value);
  lottery.status = "drawn";
  lottery.draw = {
    round,
    randomness,
    signature,
    algorithm: "deterministic-v1",
    drawnAt: new Date().toISOString(),
    digest: `sha256:${digest}`,
  };
  lotteries.set(lottery.code, lottery);
  return lottery;
}
