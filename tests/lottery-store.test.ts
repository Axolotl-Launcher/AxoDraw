import assert from "node:assert/strict";
import test from "node:test";
import { parseDrawRequestBody } from "../src/lib/draw-request";
import {
  computeDrawResult,
  computeEntriesCommitment,
  createLottery,
  drawLottery,
  hash,
  type Lottery,
} from "../src/lib/lottery-store";
import { verifyDrawRecord } from "../src/lib/verify-draw";

function fixture(overrides: Partial<Lottery> = {}): Lottery {
  const lottery: Lottery = {
    code: "AXO-TEST",
    title: "test",
    description: "",
    deadline: "2030-01-01T00:00:00.000Z",
    winnerCount: 2,
    duplicatePolicy: "keep",
    entries: ["a", "b", "c", "d", "e"],
    status: "scheduled",
    winners: [],
    managementTokenHash: "test",
    commitmentUpdatedAt: "2029-12-31T23:59:00.000Z",
    ...overrides,
  };
  lottery.entriesCommitment = computeEntriesCommitment(lottery);
  return lottery;
}

test("deterministic-v2 has a stable cross-implementation vector", () => {
  const lottery = fixture();
  assert.equal(
    lottery.entriesCommitment,
    "sha256:26030f8047aea28e25b430dff8340978591b436cf863f30d5a72648dedc8bdd6",
  );
  assert.deepEqual(
    computeDrawResult(lottery, "00".repeat(32), "deterministic-v2"),
    {
      digest:
        "sha256:1052b095ac3c895cc96668c3f3c3ddc6c0ca91ad43330981be761098c6953b84",
      winners: ["b", "c"],
    },
  );
});

test("new lotteries use a 64-bit public code and publish a commitment", () => {
  const { lottery, managementToken } = createLottery({
    title: "new",
    description: "",
    deadline: "2030-01-01T00:00:00.000Z",
    winnerCount: 1,
    duplicatePolicy: "keep",
    entries: ["a", "b"],
  });
  assert.match(lottery.code, /^AXO-[0-9A-F]{16}$/);
  assert.match(managementToken, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(lottery.entriesCommitment, computeEntriesCommitment(lottery));
});

test("deterministic-v2 removes the v1 low-bit permutation restriction", () => {
  const lottery = fixture({
    code: "AXO-FAIR",
    title: "fair",
    winnerCount: 4,
    entries: ["a", "b", "c", "d"],
  });
  const permutations = new Set<string>();
  const firstCounts = new Map(lottery.entries.map((entry) => [entry, 0]));

  for (let index = 0; index < 10_000; index += 1) {
    const result = computeDrawResult(
      lottery,
      hash(String(index)),
      "deterministic-v2",
    );
    permutations.add(result.winners.join(""));
    firstCounts.set(
      result.winners[0],
      (firstCounts.get(result.winners[0]) ?? 0) + 1,
    );
  }

  assert.equal(permutations.size, 24);
  for (const count of firstCounts.values()) {
    assert.ok(count > 2_300 && count < 2_700, `unexpected count ${count}`);
  }
});

test("legacy deterministic-v1 records remain reproducible but are not reused", () => {
  const lottery = fixture({
    code: "AXO-7K4M",
    winnerCount: 3,
    entries: [
      "service-001",
      "service-002",
      "service-003",
      "service-004",
      "service-005",
    ],
  });
  assert.deepEqual(
    computeDrawResult(
      lottery,
      "f876d09fc9438e7d53dafb9bd1f2f3c78fe4e85ad9d272e1f979aa572247fb7a",
      "deterministic-v1",
    ),
    {
      digest:
        "sha256:f9e3cba8be88cbe68e6d0c67fcc93a7b308a5ecb939cebec8017e544ddb3ad96",
      winners: ["service-003", "service-004", "service-002"],
    },
  );
});

test("draw refuses a changed list and records a verified v2 beacon", () => {
  const lottery = fixture();
  lottery.entries[0] = "tampered";
  assert.throws(
    () =>
      drawLottery(lottery, {
        round: 1,
        randomness: "00".repeat(32),
        signature: "11".repeat(48),
        verified: true,
      }),
    /承诺缺失或与当前记录不一致/,
  );

  lottery.entries[0] = "a";
  drawLottery(lottery, {
    round: 1,
    randomness: "00".repeat(32),
    signature: "11".repeat(48),
    verified: true,
  });
  assert.equal(lottery.draw?.algorithm, "deterministic-v2");
  assert.equal(lottery.draw?.entriesCommitment, lottery.entriesCommitment);
});

test("verification detects round, result, and commitment tampering", () => {
  const beacon = {
    round: 1,
    randomness: "00".repeat(32),
    signature: "11".repeat(48),
    verified: true as const,
  };
  const lottery = fixture();
  drawLottery(lottery, beacon);
  assert.equal(verifyDrawRecord(lottery, beacon, 1).verified, true);

  lottery.draw!.round = 2;
  assert.equal(verifyDrawRecord(lottery, beacon, 1).checks.expectedRound, false);
  lottery.draw!.round = 1;

  lottery.winners[0] = "attacker";
  assert.equal(verifyDrawRecord(lottery, beacon, 1).checks.winnersMatch, false);
  lottery.winners = computeDrawResult(
    lottery,
    beacon.randomness,
    "deterministic-v2",
  ).winners;

  lottery.entries[0] = "tampered";
  assert.equal(
    verifyDrawRecord(lottery, beacon, 1).checks.commitmentMatches,
    false,
  );
});

test("draw request accepts authentication only", () => {
  assert.deepEqual(parseDrawRequestBody({ token: "secret" }), {
    token: "secret",
  });
  for (const field of ["round", "randomness", "signature"]) {
    assert.throws(
      () => parseDrawRequestBody({ token: "secret", [field]: "attacker" }),
      new RegExp(field),
    );
  }
  assert.throws(() => parseDrawRequestBody(null), /请求格式无效/);
});
