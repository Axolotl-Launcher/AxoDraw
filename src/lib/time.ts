// 全站统一使用北京时间（Asia/Shanghai，UTC+8）作为唯一的时间基准：
// - 创建抽奖时，表单里的 datetime-local 值按北京时间解释，再转成 ISO(UTC) 存储；
// - 所有面向用户的展示与错误信息都用 formatBeijing 输出，与服务器/浏览器时区无关。
// 中国不使用夏令时，Asia/Shanghai 恒定 UTC+8。

export const BEIJING_TIME_ZONE = "Asia/Shanghai";

/** 截止时间后等待多久才允许开奖（drand 信标需在截止后生成，保证不可提前预测）。 */
export const UNLOCK_DELAY_MS = 10 * 60 * 1000;

const beijingFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: BEIJING_TIME_ZONE,
});

/** 将任意时间值格式化为北京时间展示，如「2026年8月24日 19:21」。 */
export function formatBeijing(value: string | number | Date): string {
  return beijingFormatter.format(new Date(value));
}

/**
 * 解析创建表单提交的截止时间，统一按北京时间（UTC+8）解释：
 * - 不带时区的 datetime-local 值（如 "2026-08-24T19:11"）→ 视为北京时间；
 * - 已带时区偏移 / Z 的 ISO 字符串 → 直接解析（便于未来扩展或外部调用）。
 * 解析失败返回 null，调用方负责校验。
 */
export function parseBeijingDatetimeLocal(value: string): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  // 已带显式时区（Z 或 ±HH:MM）：按原意解析
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(raw)) {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  // datetime-local：按北京时间补齐 +08:00 偏移
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?$/.exec(raw);
  if (!match) return null;
  const date = new Date(`${match[1]}${match[2] ? `:${match[2]}` : ":00"}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 将毫秒时长格式化为人类可读的中文描述（用于「还需等待多久」）。 */
export function humanizeDuration(milliseconds: number): string {
  const minutes = Math.max(0, milliseconds) / 60_000;
  if (minutes < 1) return "不到 1 分钟";
  if (minutes < 60) return `${Math.ceil(minutes)} 分钟`;
  const hours = Math.floor(Math.ceil(minutes) / 60);
  const remainder = Math.ceil(minutes) % 60;
  return remainder > 0 ? `${hours} 小时 ${remainder} 分钟` : `${hours} 小时`;
}