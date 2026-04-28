/**
 * 代理监控API
 * GET /api/proxy/stats - 获取代理统计信息
 * POST /api/proxy/clear-cache - 清空缓存
 */

import { proxyConfig } from "@/lib/proxy-config";
import { proxyMiddleware } from "@/lib/proxy-middleware";

function toResponse(data, status = 200) {
  return Response.json(data, { status });
}

export const runtime = "nodejs";

/**
 * GET /api/proxy/stats
 * 获取代理运行统计信息
 */
export async function GET(request) {
  try {
    const stats = {
      timestamp: new Date().toISOString(),
      proxyConfig: proxyConfig.getStats(),
      cache: proxyMiddleware.getCacheStats(),
      recentRequests: proxyMiddleware.getRequestLog().slice(-10)
    };

    return toResponse(stats);
  } catch (error) {
    return toResponse(
      {
        error: error.message
      },
      500
    );
  }
}

/**
 * POST /api/proxy/clear-cache
 * 清空所有缓存
 */
export async function POST(request) {
  try {
    const body = await request.json();

    if (body.action === "clear-cache") {
      proxyMiddleware.clearCache();
      return toResponse({
        message: "缓存已清空",
        cache: proxyMiddleware.getCacheStats()
      });
    }

    return toResponse({ error: "未知的操作" }, 400);
  } catch (error) {
    return toResponse(
      {
        error: error.message
      },
      500
    );
  }
}
