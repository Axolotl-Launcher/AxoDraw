import { NextResponse } from "next/server";
import {
  drawLottery,
  getLottery,
  publicLottery,
  saveLottery,
  verifyToken,
} from "@/lib/lottery-store";
import {
  BeaconUnavailableError,
  fetchQuicknetBeacon,
  quicknetRoundAt,
} from "@/lib/beacon";
import { formatBeijing, humanizeDuration, UNLOCK_DELAY_MS } from "@/lib/time";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const lottery = await getLottery(code);
  if (!lottery)
    return NextResponse.json({ error: "未找到这个抽奖" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  if (
    !verifyToken(
      lottery,
      String(body.token || request.headers.get("x-management-token") || ""),
    )
  )
    return NextResponse.json({ error: "管理凭证无效" }, { status: 401 });
  if (lottery.status === "drawn")
    return NextResponse.json({ lottery: publicLottery(lottery) });

  // 截止时间 +10 分钟才允许开奖：信标轮次从解锁时刻才开始，不可提前预测
  const unlockAt = new Date(lottery.deadline).getTime() + UNLOCK_DELAY_MS;
  if (Date.now() < unlockAt)
    return NextResponse.json(
      {
        error: `请在 ${formatBeijing(unlockAt)}（北京时间）后开奖（还需等待约 ${humanizeDuration(unlockAt - Date.now())}）`,
      },
      { status: 425 },
    );

  const targetRound = quicknetRoundAt(Math.floor(unlockAt / 1000));
  let randomness = String(body.randomness || "");
  let signature = String(body.signature || "");
  let round = Number(body.round || targetRound);
  if (!randomness) {
    try {
      const beacon = await fetchQuicknetBeacon(round);
      round = beacon.round;
      signature = beacon.signature;
      randomness = beacon.randomness;
    } catch (cause) {
      const reason =
        cause instanceof BeaconUnavailableError
          ? `drand 信标（轮次 ${cause.round}）尚未发布`
          : String(cause instanceof Error ? cause.message : cause);
      return NextResponse.json(
        { error: `${reason}，请稍候几秒重试` },
        { status: 425 },
      );
    }
  }
  drawLottery(lottery, randomness, signature, round);
  await saveLottery(lottery);
  return NextResponse.json({ lottery: publicLottery(lottery) });
}