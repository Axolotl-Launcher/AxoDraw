import { NextResponse } from "next/server";
import { createLottery, publicLottery, saveLottery } from "@/lib/lottery-store";

const EXPECTED_ACTION = "create-lottery";

async function verifyTurnstile(
  token: string,
  request: Request,
): Promise<boolean> {
  const hostnames = new Set(
    (process.env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > 2048 ||
    hostnames.size === 0
  )
    return false;
  let result:
    | { success?: boolean; action?: string; hostname?: string }
    | undefined;
  try {
    const params = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET ?? "",
      response: token,
    });
    const forwarded = request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim();
    if (forwarded) params.set("remoteip", forwarded);
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(10_000),
        body: params,
      },
    );
    if (!response.ok) return false;
    result = await response.json();
  } catch {
    return false; // siteverify 网络异常一律拒绝（fail closed）
  }
  return (
    result?.success === true &&
    result.action === EXPECTED_ACTION &&
    hostnames.has(result.hostname ?? "")
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (
      !(await verifyTurnstile(
        String(body["cf-turnstile-response"] ?? ""),
        request,
      ))
    )
      return NextResponse.json(
        { error: "人机验证未通过，请稍后重试" },
        { status: 403 },
      );
    const title = String(body.title || "").trim();
    const entries = String(body.entriesText || "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!title)
      return NextResponse.json({ error: "请填写抽奖标题" }, { status: 400 });
    if (entries.length < 2)
      return NextResponse.json(
        { error: "至少需要 2 条参与值" },
        { status: 400 },
      );
    const winnerCount = Number(body.winnerCount);
    if (
      !Number.isInteger(winnerCount) ||
      winnerCount < 1 ||
      winnerCount > entries.length
    )
      return NextResponse.json(
        { error: "中奖人数需在 1 与参与值数量之间" },
        { status: 400 },
      );
    const deadline = new Date(String(body.deadline));
    if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now())
      return NextResponse.json(
        { error: "截止时间需晚于当前时间" },
        { status: 400 },
      );
    const normalizedEntries =
      body.duplicatePolicy === "dedupe" ? [...new Set(entries)] : entries;
    if (normalizedEntries.length < winnerCount)
      return NextResponse.json(
        { error: "去重后参与值不足" },
        { status: 400 },
      );
    const created = createLottery({
      title,
      description: String(body.description || "").trim(),
      deadline: deadline.toISOString(),
      winnerCount,
      duplicatePolicy: body.duplicatePolicy === "dedupe" ? "dedupe" : "keep",
      entries: normalizedEntries,
    });
    await saveLottery(created.lottery);
    return NextResponse.json(
      {
        lottery: {
          ...publicLottery(created.lottery),
          managementToken: created.managementToken,
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
}
