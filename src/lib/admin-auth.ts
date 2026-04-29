import { timingSafeEqual } from "node:crypto";

function toErrorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function readBearerToken(value: string): string {
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function isSameToken(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function readAdminToken(request: Request): string {
  const headerToken = request.headers.get("x-proxy-admin-token")?.trim();
  if (headerToken) {
    return headerToken;
  }

  return readBearerToken(request.headers.get("authorization") || "");
}

export function validateAdminRequest(
  request: Request,
  expectedToken = process.env.PROXY_ADMIN_TOKEN || ""
): Response | null {
  if (!expectedToken) {
    return toErrorResponse("未配置 PROXY_ADMIN_TOKEN，代理监控接口已关闭", 403);
  }

  const receivedToken = readAdminToken(request);
  if (!receivedToken) {
    return toErrorResponse("请提供代理监控访问令牌", 401);
  }

  if (!isSameToken(receivedToken, expectedToken)) {
    return toErrorResponse("代理监控访问令牌无效", 403);
  }

  return null;
}
