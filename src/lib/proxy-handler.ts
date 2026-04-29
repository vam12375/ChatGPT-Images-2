/**
 * 反向代理 API 处理器：统一封装 OpenAI 调用、重试、缓存和响应归一化。
 */
import type { GenerationUsage } from "@/lib/generation-history-types";
import {
  buildOpenAIImageRequest,
  type ImageOutputFormat,
  type ImageRequestOptions,
  type OpenAIImagePayload
} from "@/lib/image-options";
import { callOpenAIWithRetry } from "@/lib/openai-retry";
import { proxyConfig } from "@/lib/proxy-config";
import { proxyMiddleware } from "@/lib/proxy-middleware";

export type GeneratedImage = {
  id: string;
  dataUrl: string;
};

export type ProxyResult = {
  images: GeneratedImage[];
  model: string;
  usage: GenerationUsage | null;
  cached?: boolean;
};

type OpenAIImageData = {
  b64_json?: string;
  url?: string;
};

type OpenAIImageResponse = {
  created?: number;
  data?: OpenAIImageData[];
  usage?: unknown;
};

type OpenAIResponsesOutput = {
  id?: string;
  result?: string;
  type?: string;
};

type OpenAIResponsesResponse = {
  created_at?: number;
  model?: string;
  output?: OpenAIResponsesOutput[];
  usage?: unknown;
};

type OpenAIResponsesImageTool = {
  type: "image_generation";
  quality?: ImageRequestOptions["quality"];
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  output_format?: ImageOutputFormat;
};

type OpenAIResponsesPayload = {
  input: string;
  model: string;
  tools: [OpenAIResponsesImageTool];
};

type OpenAIClient = {
  images: {
    generate(payload: OpenAIImagePayload): Promise<OpenAIImageResponse>;
  };
  responses: {
    create(payload: OpenAIResponsesPayload): Promise<OpenAIResponsesResponse>;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readUsage(usage: unknown): GenerationUsage | null {
  const usageRecord = asRecord(usage);
  const totalTokens = readOptionalNumber(usageRecord.total_tokens);
  const inputTokens =
    readOptionalNumber(usageRecord.input_tokens) ??
    readOptionalNumber(usageRecord.prompt_tokens);
  const outputTokens =
    readOptionalNumber(usageRecord.output_tokens) ??
    readOptionalNumber(usageRecord.completion_tokens);

  if (
    totalTokens === undefined &&
    inputTokens === undefined &&
    outputTokens === undefined
  ) {
    return null;
  }

  return {
    total_tokens: totalTokens,
    input_tokens: inputTokens,
    output_tokens: outputTokens
  };
}

function mergeUsages(usages: Array<GenerationUsage | null>): GenerationUsage | null {
  const merged: GenerationUsage = {};
  let hasValue = false;

  for (const usage of usages) {
    if (!usage) {
      continue;
    }

    if (typeof usage.total_tokens === "number") {
      merged.total_tokens = (merged.total_tokens ?? 0) + usage.total_tokens;
      hasValue = true;
    }

    if (typeof usage.input_tokens === "number") {
      merged.input_tokens = (merged.input_tokens ?? 0) + usage.input_tokens;
      hasValue = true;
    }

    if (typeof usage.output_tokens === "number") {
      merged.output_tokens = (merged.output_tokens ?? 0) + usage.output_tokens;
      hasValue = true;
    }
  }

  return hasValue ? merged : null;
}

function toBase64ImageDataUrl(
  base64Data: string,
  outputFormat: ImageOutputFormat
): string {
  return `data:image/${outputFormat};base64,${base64Data}`;
}

function toImageDataUrl(
  image: OpenAIImageData,
  outputFormat: ImageOutputFormat
): string {
  if (image.b64_json) {
    return toBase64ImageDataUrl(image.b64_json, outputFormat);
  }

  if (image.url) {
    return image.url;
  }

  throw new Error("OpenAI 未返回图片数据");
}

function readResponsesSize(
  size: string
): "1024x1024" | "1024x1536" | "1536x1024" {
  const match = size.toLowerCase().match(/^(\d+)x(\d+)$/);

  if (!match) {
    return "1024x1024";
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return "1024x1024";
  }

  if (width === height) {
    return "1024x1024";
  }

  return width < height ? "1024x1536" : "1536x1024";
}

function buildOpenAIResponsesRequest(
  options: ImageRequestOptions,
  model: string
): OpenAIResponsesPayload {
  return {
    model,
    input: options.prompt,
    tools: [
      {
        type: "image_generation",
        size: readResponsesSize(options.size),
        quality: options.quality,
        output_format: options.outputFormat
      }
    ]
  };
}

function toImagesFromImageResponse(
  response: OpenAIImageResponse,
  outputFormat: ImageOutputFormat
): GeneratedImage[] {
  const images = (response.data || []).map((image, index) => ({
    id: `${response.created || Date.now()}-${index}`,
    dataUrl: toImageDataUrl(image, outputFormat)
  }));

  if (images.length === 0) {
    throw new Error("OpenAI 未返回图片数据");
  }

  return images;
}

function toImagesFromResponsesResponse(
  response: OpenAIResponsesResponse,
  outputFormat: ImageOutputFormat,
  responseIndex: number
): GeneratedImage[] {
  const imageOutputs = (response.output || []).filter(
    (output) =>
      output.type === "image_generation_call" &&
      typeof output.result === "string" &&
      output.result.length > 0
  );

  if (imageOutputs.length === 0) {
    throw new Error("OpenAI 未返回图片数据");
  }

  return imageOutputs.map((output, index) => ({
    id: `${output.id || response.created_at || Date.now()}-${responseIndex}-${index}`,
    dataUrl: toBase64ImageDataUrl(output.result as string, outputFormat)
  }));
}

async function generateWithImagesApi(
  openai: OpenAIClient,
  options: ImageRequestOptions,
  model: string
): Promise<ProxyResult> {
  const payload = buildOpenAIImageRequest(options, model);
  const response = await callOpenAIWithRetry(() => openai.images.generate(payload));

  return {
    images: toImagesFromImageResponse(response, options.outputFormat),
    model,
    usage: readUsage(response.usage)
  };
}

async function generateWithResponsesApi(
  openai: OpenAIClient,
  options: ImageRequestOptions,
  model: string
): Promise<ProxyResult> {
  const payload = buildOpenAIResponsesRequest(options, model);
  const responses: OpenAIResponsesResponse[] = [];

  // Responses API 的 image_generation 工具按张生成，按数量逐次调用后合并结果。
  for (let index = 0; index < options.count; index += 1) {
    responses.push(
      await callOpenAIWithRetry(() => openai.responses.create(payload))
    );
  }

  return {
    images: responses.flatMap((response, responseIndex) =>
      toImagesFromResponsesResponse(response, options.outputFormat, responseIndex)
    ),
    model: responses[0]?.model || model,
    usage: mergeUsages(responses.map((response) => readUsage(response.usage)))
  };
}

export async function handleProxyRequest(
  options: ImageRequestOptions
): Promise<ProxyResult> {
  const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const responsesModel = process.env.OPENAI_RESPONSES_MODEL || "gpt-4.1-mini";
  const activeModel = options.apiMode === "responses" ? responsesModel : imageModel;
  const cacheKey = proxyMiddleware.generateCacheKey(options, activeModel);

  if (process.env.ENABLE_PROXY_CACHE === "true") {
    const cached = proxyMiddleware.getFromCache<ProxyResult>(cacheKey);
    if (cached) {
      console.log("返回缓存的图片");
      return {
        ...cached,
        cached: true
      };
    }
  }

  if (process.env.ENABLE_REQUEST_LOG === "true") {
    proxyMiddleware.logRequest(options);
  }

  const apiKey = proxyConfig.getNextApiKey();

  const { default: OpenAI } = await import("openai");
  const openaiConfig: { apiKey: string; baseURL?: string } = { apiKey };
  if (process.env.OPENAI_BASE_URL) {
    openaiConfig.baseURL = process.env.OPENAI_BASE_URL;
  }

  const openai = new OpenAI(openaiConfig) as OpenAIClient;
  const result =
    options.apiMode === "responses"
      ? await generateWithResponsesApi(openai, options, responsesModel)
      : await generateWithImagesApi(openai, options, imageModel);

  if (process.env.ENABLE_PROXY_CACHE === "true") {
    proxyMiddleware.setCache(cacheKey, result);
  }

  return result;
}
