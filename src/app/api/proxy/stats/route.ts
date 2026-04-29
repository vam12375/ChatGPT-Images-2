/**
 * 代理监控 API：提供缓存和 Key 轮转统计，便于排查生成请求状态。
 */
import { validateAdminRequest } from "@/lib/admin-auth";
import { proxyConfig } from "@/lib/proxy-config";
import { proxyMiddleware } from "@/lib/proxy-middleware";

export const runtime = "nodejs";

function toResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "代理统计接口异常";
}

export async function GET(request: Request): Promise<Response> {
  const authError = validateAdminRequest(request);
  if (authError) {
    return authError;
  }

  try {
    return toResponse({
      timestamp: new Date().toISOString(),
      proxyConfig: proxyConfig.getStats(),
      cache: proxyMiddleware.getCacheStats(),
      recentRequests: proxyMiddleware.getRequestLog().slice(-10)
    });
  } catch (error) {
    return toResponse({ error: readErrorMessage(error) }, 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  const authError = validateAdminRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const body = (await request.json()) as { action?: string };

    if (body.action === "clear-cache") {
      proxyMiddleware.clearCache();
      return toResponse({
        message: "缓存已清空",
        cache: proxyMiddleware.getCacheStats()
      });
    }

    return toResponse({ error: "未知操作" }, 400);
  } catch (error) {
    return toResponse({ error: readErrorMessage(error) }, 500);
  }
}
