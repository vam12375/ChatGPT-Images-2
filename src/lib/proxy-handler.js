/**
 * 反向代理API处理器
 * 支持缓存、负载均衡、错误重试
 */

import { proxyConfig } from "@/lib/proxy-config";
import { proxyMiddleware } from "@/lib/proxy-middleware";

/**
 * 使用重试机制调用OpenAI API
 */
async function callOpenAIWithRetry(openaiClient, payload, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openaiClient.images.generate(payload);
      return response;
    } catch (error) {
      lastError = error;

      // 某些错误不应该重试
      if (error.status === 401 || error.status === 403) {
        throw error;
      }

      // 如果不是最后一次尝试，等待后重试
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt - 1) * 1000; // 指数退避
        console.warn(
          `OpenAI API调用失败（尝试${attempt}/${maxRetries}），${delayMs}ms后重试:`,
          error.message
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * 处理反向代理请求
 */
export async function handleProxyRequest(
  options,
  buildRequestFn,
  formatErrorFn
) {
  // 生成缓存键
  const cacheKey = proxyMiddleware.generateCacheKey(
    options.prompt,
    options.size,
    process.env.OPENAI_IMAGE_MODEL || "dall-e-3"
  );

  // 检查缓存
  if (process.env.ENABLE_PROXY_CACHE === "true") {
    const cached = proxyMiddleware.getFromCache(cacheKey);
    if (cached) {
      console.log("返回缓存的图片");
      return {
        images: cached.images,
        model: cached.model,
        usage: cached.usage,
        cached: true
      };
    }
  }

  // 记录请求
  if (process.env.ENABLE_REQUEST_LOG === "true") {
    proxyMiddleware.logRequest(options);
  }

  // 获取API密钥
  const apiKey = proxyConfig.getNextApiKey();

  const model = process.env.OPENAI_IMAGE_MODEL || "dall-e-3";

  // 动态导入OpenAI
  const { default: OpenAI } = await import("openai");
  
  // 配置 OpenAI 客户端，支持自定义 Base URL
  const openaiConfig = { apiKey };
  if (process.env.OPENAI_BASE_URL) {
    openaiConfig.baseURL = process.env.OPENAI_BASE_URL;
  }
  
  const openai = new OpenAI(openaiConfig);

  try {
    // 构建请求体
    const payload = buildRequestFn(options, model);

    // 调用OpenAI API（带重试）
    const response = await callOpenAIWithRetry(openai, payload);

    // 处理响应
    const images = (response.data || []).map((image, index) => {
      if (!image.b64_json && !image.url) {
        throw new Error("OpenAI未返回图片数据");
      }

      return {
        id: `${response.created || Date.now()}-${index}`,
        dataUrl: image.b64_json
          ? `data:image/${options.outputFormat};base64,${image.b64_json}`
          : image.url
      };
    });

    const result = {
      images,
      model,
      usage: response.usage || null
    };

    // 缓存结果
    if (process.env.ENABLE_PROXY_CACHE === "true") {
      proxyMiddleware.setCache(cacheKey, result);
    }

    return result;
  } catch (error) {
    const formattedError = formatErrorFn(error);
    throw formattedError;
  }
}
