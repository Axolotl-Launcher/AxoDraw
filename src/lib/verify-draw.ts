import type { QuicknetBeacon } from "@/lib/beacon";
import {
  computeDrawResult,
  computeEntriesCommitment,
  CURRENT_DRAW_ALGORITHM,
  type DrawAlgorithm,
  type Lottery,
} from "@/lib/lottery-store";

const supportedAlgorithms = new Set<DrawAlgorithm>([
  "deterministic-v1",
  CURRENT_DRAW_ALGORITHM,
]);

type DrawVerificationChecks = {
  expectedRound: boolean;
  beaconSignature: boolean;
  commitmentBeforeDeadline: boolean;
  commitmentMatches: boolean;
  algorithmSupported: boolean;
  fairAlgorithm: boolean;
  digestMatches: boolean;
  winnersMatch: boolean;
};

export type DrawRecordVerification = {
  verified: boolean;
  fair: boolean;
  checks: DrawVerificationChecks;
  expectedCommitment: string;
  reason: string;
};

export function verifyDrawRecord(
  lottery: Lottery,
  beacon: QuicknetBeacon,
  expectedRound: number,
): DrawRecordVerification {
  const draw = lottery.draw;
  if (!draw) {
    return {
      verified: false,
      fair: false,
      checks: {
        expectedRound: false,
        beaconSignature: false,
        commitmentBeforeDeadline: false,
        commitmentMatches: false,
        algorithmSupported: false,
        fairAlgorithm: false,
        digestMatches: false,
        winnersMatch: false,
      },
      expectedCommitment: computeEntriesCommitment(lottery),
      reason: "抽奖尚未开奖",
    };
  }

  const algorithm = draw.algorithm;
  const algorithmSupported = supportedAlgorithms.has(algorithm);
  const fairAlgorithm = algorithm === CURRENT_DRAW_ALGORITHM;
  const expectedCommitment = computeEntriesCommitment(lottery);
  const commitmentUpdatedAt = new Date(
    lottery.commitmentUpdatedAt ?? "",
  ).getTime();
  const commitmentBeforeDeadline =
    Number.isFinite(commitmentUpdatedAt) &&
    commitmentUpdatedAt < new Date(lottery.deadline).getTime();
  const commitmentMatches =
    lottery.entriesCommitment === expectedCommitment &&
    draw.entriesCommitment === expectedCommitment;

  let digestMatches = false;
  let winnersMatch = false;
  if (algorithmSupported) {
    const expectedResult = computeDrawResult(
      lottery,
      beacon.randomness,
      algorithm,
    );
    digestMatches = draw.digest === expectedResult.digest;
    winnersMatch =
      lottery.winners.length === expectedResult.winners.length &&
      lottery.winners.every(
        (winner, index) => winner === expectedResult.winners[index],
      );
  }

  const checks = {
    expectedRound: draw.round === expectedRound,
    beaconSignature:
      draw.signature === beacon.signature &&
      draw.randomness === beacon.randomness,
    commitmentBeforeDeadline,
    commitmentMatches,
    algorithmSupported,
    fairAlgorithm,
    digestMatches,
    winnersMatch,
  };
  const verified = Object.values(checks).every(Boolean);

  return {
    verified,
    fair: verified,
    checks,
    expectedCommitment,
    reason: verified
      ? "轮次、信标签名、参与值承诺、无偏算法、摘要和中奖名单均验证通过"
      : fairAlgorithm
        ? "至少一项验证未通过"
        : "旧版 deterministic-v1 存在顺序偏差，不能视为公平结果",
  };
}
