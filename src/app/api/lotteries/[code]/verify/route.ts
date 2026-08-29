import { NextResponse } from "next/server";
import { fetchQuicknetBeacon, quicknetRoundAt } from "@/lib/beacon";
import { getLottery, publicLottery } from "@/lib/lottery-store";
import { UNLOCK_DELAY_MS } from "@/lib/time";
import { verifyDrawRecord } from "@/lib/verify-draw";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const lottery = await getLottery(code);
  if (!lottery)
    return NextResponse.json({ error: "未找到这个抽奖" }, { status: 404 });
  if (!lottery.draw)
    return NextResponse.json({
      verified: false,
      fair: false,
      reason: "抽奖尚未开奖",
      lottery: publicLottery(lottery),
    });

  const expectedRound = quicknetRoundAt(
    Math.floor(
      (new Date(lottery.deadline).getTime() + UNLOCK_DELAY_MS) / 1000,
    ),
  );
  let beacon;
  try {
    // This fetch verifies the pinned quicknet identity, exact round,
    // randomness derivation, and BLS signature before returning.
    beacon = await fetchQuicknetBeacon(expectedRound);
  } catch (cause) {
    return NextResponse.json(
      {
        verified: false,
        fair: false,
        reason: `无法独立验证 drand 信标：${cause instanceof Error ? cause.message : String(cause)}`,
        lottery: publicLottery(lottery),
      },
      { status: 503 },
    );
  }

  const verification = verifyDrawRecord(lottery, beacon, expectedRound);

  return NextResponse.json({
    ...verification,
    expectedRound,
    lottery: publicLottery(lottery),
  });
}
