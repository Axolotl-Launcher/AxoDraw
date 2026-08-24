import { NextResponse } from "next/server";
import { getLottery, publicLottery } from "@/lib/lottery-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const lottery = await getLottery(code);
  if (!lottery)
    return NextResponse.json({ error: "未找到这个抽奖" }, { status: 404 });
  return NextResponse.json({
    verified: Boolean(lottery.draw),
    lottery: publicLottery(lottery),
  });
}
