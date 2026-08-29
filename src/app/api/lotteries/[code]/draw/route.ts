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
import { parseDrawRequestBody } from "@/lib/draw-request";
import { formatBeijing, humanizeDuration, UNLOCK_DELAY_MS } from "@/lib/time";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const lottery = await getLottery(code);
  if (!lottery)
    return NextResponse.json({ error: "未找到这个抽奖" }, { status: 404 });
  let body;
  try {
    body = parseDrawRequestBody(await request.json().catch(() => ({})));
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "请求格式无效" },
      { status: 400 },
    );
  }
  if (
    !verifyToken(
      lottery,
      String(body.token || request.headers.get("x-management-token") || ""),
    )
  )
    return NextResponse.json({ error: "管理凭证无效" }, { status: 401 });
  if (lottery.status === "drawn")
    return NextResponse.json({ lottery: publicLottery(lottery) });

  // 截止时间 +10 分钟才允许开奖；解锁时刻唯一映射到一个目标轮次。
  const unlockAt = new Date(lottery.deadline).getTime() + UNLOCK_DELAY_MS;
  if (Date.now() < unlockAt)
    return NextResponse.json(
      {
        error: `请在 ${formatBeijing(unlockAt)}（北京时间）后开奖（还需等待约 ${humanizeDuration(unlockAt - Date.now())}）`,
      },
      { status: 425 },
    );

  const commitmentUpdatedAt = new Date(
    lottery.commitmentUpdatedAt ?? "",
  ).getTime();
  if (
    !lottery.entriesCommitment ||
    !Number.isFinite(commitmentUpdatedAt) ||
    commitmentUpdatedAt >= new Date(lottery.deadline).getTime()
  ) {
    return NextResponse.json(
      {
        error:
          "该抽奖缺少截止前生成的参与值承诺，无法安全开奖；请重新创建抽奖",
      },
      { status: 409 },
    );
  }

  // The request cannot override this value: one deadline maps to one round.
  const targetRound = quicknetRoundAt(Math.floor(unlockAt / 1000));
  let beacon;
  try {
    beacon = await fetchQuicknetBeacon(targetRound);
  } catch (cause) {
    const reason =
      cause instanceof BeaconUnavailableError
        ? `drand 信标（轮次 ${cause.round}）获取或验证失败：${cause.message}`
        : String(cause instanceof Error ? cause.message : cause);
    return NextResponse.json(
      { error: `${reason}，请稍候几秒重试` },
      { status: 425 },
    );
  }
  try {
    drawLottery(lottery, beacon);
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "抽奖记录验证失败" },
      { status: 409 },
    );
  }
  await saveLottery(lottery);
  return NextResponse.json({ lottery: publicLottery(lottery) });
}
