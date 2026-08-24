import { NextResponse } from "next/server";
import {
  getLottery,
  publicLottery,
  saveLottery,
  verifyToken,
} from "@/lib/lottery-store";
import { formatBeijing } from "@/lib/time";

function readToken(request: Request, body: Record<string, unknown>) {
  return String(body.token || request.headers.get("x-management-token") || "");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const lottery = await getLottery(code);
  if (!lottery)
    return NextResponse.json({ error: "未找到这个抽奖" }, { status: 404 });
  return NextResponse.json({ lottery: publicLottery(lottery) });
}

/**
 * 通过管理链接在截止时间之前修改参与值。
 * - 仅限未开奖且未过截止时间的抽奖；
 * - 参与值需至少 2 条；沿用创建时的去重策略；去重后数量需不少于中奖名额；
 * - 修改会影响最终 digest 的输入，但开奖信标在截止后才生成，无法据此作弊。
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const lottery = await getLottery(code);
  if (!lottery)
    return NextResponse.json({ error: "未找到这个抽奖" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  if (!verifyToken(lottery, readToken(request, body)))
    return NextResponse.json({ error: "管理凭证无效" }, { status: 401 });
  if (lottery.status === "drawn")
    return NextResponse.json(
      { error: "已开奖，无法再修改参与值" },
      { status: 409 },
    );
  const deadlineAt = new Date(lottery.deadline).getTime();
  if (Date.now() >= deadlineAt)
    return NextResponse.json(
      {
        error: `已过截止时间（${formatBeijing(deadlineAt)} 北京时间），无法再修改参与值`,
      },
      { status: 409 },
    );

  const items = String(body.entriesText ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length < 2)
    return NextResponse.json(
      { error: "至少需要 2 条参与值" },
      { status: 400 },
    );
  const normalized =
    lottery.duplicatePolicy === "dedupe" ? [...new Set(items)] : items;
  if (normalized.length < lottery.winnerCount)
    return NextResponse.json(
      { error: "去重后参与值不足中奖名额" },
      { status: 400 },
    );

  lottery.entries = normalized;
  await saveLottery(lottery);
  return NextResponse.json({ lottery: publicLottery(lottery) });
}