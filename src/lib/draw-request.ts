export class InvalidDrawRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDrawRequestError";
  }
}

/** The draw caller may authenticate, but may never provide entropy inputs. */
export function parseDrawRequestBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidDrawRequestError("请求格式无效");
  }
  const body = value as Record<string, unknown>;
  const unexpectedFields = Object.keys(body).filter((key) => key !== "token");
  if (unexpectedFields.length > 0) {
    throw new InvalidDrawRequestError(
      `开奖参数只能包含管理凭证，禁止客户端指定：${unexpectedFields.join(", ")}`,
    );
  }
  return { token: String(body.token ?? "") };
}
