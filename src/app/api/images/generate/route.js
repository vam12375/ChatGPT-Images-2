import {
  buildOpenAIImageRequest,
  parseImageRequest
} from "@/lib/image-options";
import { formatOpenAIError } from "@/lib/openai-error";
import { handleProxyRequest } from "@/lib/proxy-handler";

export const runtime = "nodejs";

function toErrorResponse(message, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request) {
  let options;

  try {
    options = parseImageRequest(await request.json());
  } catch (error) {
    return toErrorResponse(error.message || "请求参数无效");
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
    const formattedError = formatOpenAIError(error);
    return toErrorResponse(formattedError.message, formattedError.status);
  }
}
