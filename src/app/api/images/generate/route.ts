import {
  buildOpenAIImageRequest,
  parseImageRequest
} from "@/lib/image-options";
import { formatOpenAIError } from "@/lib/openai-error";
import { handleProxyRequest } from "@/lib/proxy-handler";

export const runtime = "nodejs";

function toErrorResponse(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

function readErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(request: Request): Promise<Response> {
  let options;

  try {
    options = parseImageRequest(await request.json());
  } catch (error) {
    return toErrorResponse(readErrorMessage(error, "请求参数无效"));
  }

  try {
    const result = await handleProxyRequest(
      options,
      buildOpenAIImageRequest,
      formatOpenAIError
    );

    return Response.json({
      images: result.images,
      model: result.model,
      usage: result.usage,
      cached: result.cached || false
    });
  } catch (error) {
    // 统一出口保留中文错误，避免把 SDK 原始对象直接暴露给前端。
    const formattedError = formatOpenAIError(error);
    return toErrorResponse(formattedError.message, formattedError.status);
  }
}
