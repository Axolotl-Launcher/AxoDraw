import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  drawLottery,
  getLottery,
  publicLottery,
  saveLottery,
  verifyToken,
} from "@/lib/lottery-store";

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
  const unlockAt = new Date(lottery.deadline).getTime() + 10 * 60 * 1000;
  if (Date.now() < unlockAt)
    return NextResponse.json(
      { error: `请在 ${new Date(unlockAt).toISOString()} 后开奖` },
      { status: 425 },
    );
  const targetRound =
    Math.floor((Math.floor(unlockAt / 1000) - 1692803367) / 3) + 1;
  let randomness = String(body.randomness || "");
  let signature = String(body.signature || "");
  let round = Number(body.round || targetRound);
  if (!randomness) {
    const beacon = await fetch(
      `https://api.drand.sh/v2/beacons/quicknet/rounds/${round}`,
      { cache: "no-store" },
    );
    if (!beacon.ok)
      return NextResponse.json(
        { error: "目标 drand 信标尚未生成，请稍后重试", round },
        { status: 425 },
      );
    const payload = (await beacon.json()) as {
      round: number;
      randomness?: string;
      signature: string;
    };
    round = payload.round;
    signature = payload.signature;
    // quicknet 为 unchained 网络，API 只返回签名，随机数按规范由签名推导
    randomness =
      payload.randomness ||
      createHash("sha256")
        .update(Buffer.from(signature, "hex"))
        .digest("hex");
  }
  drawLottery(lottery, randomness, signature, round);
  await saveLottery(lottery);
  return NextResponse.json({ lottery: publicLottery(lottery) });
}
