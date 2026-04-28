/**
 * 反向代理 API 处理器：统一封装 OpenAI 调用、重试、缓存和响应归一化。
 */
import { proxyConfig } from "@/lib/proxy-config";
import { proxyMiddleware } from "@/lib/proxy-middleware";

import type {
  ImageOutputFormat,
  ImageRequestOptions,
  OpenAIImagePayload
} from "@/lib/image-options";
import type { FormattedOpenAIError } from "@/lib/openai-error";

export type GeneratedImage = {
  id: string;
  dataUrl: string;
};

export type ProxyResult = {
  images: GeneratedImage[];
  model: string;
  usage: unknown | null;
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

type OpenAIClient = {
  images: {
    generate(payload: OpenAIImagePayload): Promise<OpenAIImageResponse>;
  };
};

type ErrorWithStatus = {
  status?: number;
  message?: string;
};

function readErrorStatus(error: unknown): number | undefined {
  return error && typeof error === "object"
    ? (error as ErrorWithStatus).status
    : undefined;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return error && typeof error === "object"
    ? String((error as ErrorWithStatus).message || "")
    : "";
}

async function callOpenAIWithRetry(
  openaiClient: OpenAIClient,
  payload: OpenAIImagePayload,
  maxRetries = 3
): Promise<OpenAIImageResponse> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await openaiClient.images.generate(payload);
    } catch (error) {
      lastError = error;

      // 鉴权错误重试无意义，直接交给上层格式化为用户提示。
      const status = readErrorStatus(error);
      if (status === 401 || status === 403) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delayMs = 2 ** (attempt - 1) * 1000;
        console.warn(
          `OpenAI API 调用失败（尝试 ${attempt}/${maxRetries}），${delayMs}ms 后重试`,
          readErrorMessage(error)
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

function toImageDataUrl(
  image: OpenAIImageData,
  outputFormat: ImageOutputFormat
): string {
  if (image.b64_json) {
    return `data:image/${outputFormat};base64,${image.b64_json}`;
  }

  if (image.url) {
    return image.url;
  }

  throw new Error("OpenAI 未返回图片数据");
}

export async function handleProxyRequest(
  options: ImageRequestOptions,
  buildRequestFn: (
    options: ImageRequestOptions,
    model: string
  ) => OpenAIImagePayload,
  formatErrorFn: (error: unknown) => FormattedOpenAIError
): Promise<ProxyResult> {
  const model = process.env.OPENAI_IMAGE_MODEL || "dall-e-3";
  const cacheKey = proxyMiddleware.generateCacheKey(
    options.prompt,
    options.size,
    model
  );

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

  try {
    const payload = buildRequestFn(options, model);
    const response = await callOpenAIWithRetry(openai, payload);

    const images = (response.data || []).map((image, index) => ({
      id: `${response.created || Date.now()}-${index}`,
      dataUrl: toImageDataUrl(image, options.outputFormat)
    }));

    const result: ProxyResult = {
      images,
      model,
      usage: response.usage || null
    };

    if (process.env.ENABLE_PROXY_CACHE === "true") {
      proxyMiddleware.setCache(cacheKey, result);
    }

    return result;
  } catch (error) {
    throw formatErrorFn(error);
  }
}
