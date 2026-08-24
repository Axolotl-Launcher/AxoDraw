import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Lottery } from "@/lib/lottery-store";

// 服务端专用客户端：仅使用 service_role 密钥（绝不暴露给浏览器端）。
// 未配置 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 时返回 null，
// 上层保持「无数据库回退到内存存储」的开发行为。
let cachedClient: SupabaseClient | null | undefined;

function client(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cachedClient ??= createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedClient;
}

export async function persistLottery(lottery: Lottery) {
  const db = client();
  if (!db) return;
  const { error } = await db
    .from("axodraw_lotteries")
    .upsert(
      {
        code: lottery.code,
        payload: lottery,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "code" },
    );
  if (error) {
    console.error("[supabase] persistLottery failed:", error.message);
    throw error;
  }
}

export async function loadLottery(code: string): Promise<Lottery | null> {
  const db = client();
  if (!db) return null;
  const { data, error } = await db
    .from("axodraw_lotteries")
    .select("payload")
    .eq("code", code)
    .maybeSingle<{ payload: Lottery }>();
  if (error) {
    console.error("[supabase] loadLottery failed:", error.message);
    throw error;
  }
  return (data?.payload as Lottery | null) ?? null;
}