import { createHash } from "node:crypto";

/**
 * drand quicknet（unchained，3 秒一轮）公开信标。
 * 网络参数可通过 https://api.drand.sh/v2/beacons/quicknet/info 核对。
 */
export const DRAND_QUICKNET_GENESIS = 1692803367; // 2023-08-23T22:29:27Z
export const DRAND_QUICKNET_PERIOD = 3; // 秒

// 官方公开中继（可经 /v2/beacons/quicknet/info 核对）；获取失败时按序轮换
const DRAND_API_HOSTS = [
  "https://api.drand.sh",
  "https://api2.drand.sh",
  "https://api3.drand.sh",
];

export type QuicknetBeacon = {
  round: number;
  randomness: string;
  signature: string;
};

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
  return (
    Math.floor((unixSeconds - DRAND_QUICKNET_GENESIS) / DRAND_QUICKNET_PERIOD) + 1
  );
}

/**
 * 获取指定轮次的 quicknet 信标。
 * 轮次在起始后的 1~3 秒内才发布（在此之前 API 返回 425/404），
 * 单个中继也可能临时故障或超时，因此按「限次重试 + 多中继轮换」策略获取；
 * 最终失败抛出 BeaconUnavailableError。
 */
export async function fetchQuicknetBeacon(
  round: number,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<QuicknetBeacon> {
  const attempts = Math.max(1, options.attempts ?? 5);
  const delayMs = Math.max(0, options.delayMs ?? 1_000);
  let lastReason = "信标不可用";
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const host = DRAND_API_HOSTS[attempt % DRAND_API_HOSTS.length];
    try {
      const response = await fetch(
        `${host}/v2/beacons/quicknet/rounds/${round}`,
        { cache: "no-store", signal: AbortSignal.timeout(8_000) },
      );
      if (response.ok) {
        const payload = (await response.json()) as {
          round?: number;
          randomness?: string;
          signature?: string;
        };
        if (!payload.signature) {
          lastReason = "信标响应缺少签名";
        } else {
          // quicknet 为 unchained 网络，randomness 按规范由签名 SHA-256 推导
          const randomness =
            payload.randomness ||
            createHash("sha256")
              .update(Buffer.from(payload.signature, "hex"))
              .digest("hex");
          return {
            round: payload.round ?? round,
            randomness,
            signature: payload.signature,
          };
        }
      } else {
        lastReason = `信标 API 返回 HTTP ${response.status}`;
      }
    } catch {
      lastReason = "信标 API 网络请求失败";
    }
    if (attempt + 1 < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new BeaconUnavailableError(round, lastReason);
}