const allowedSizes = new Set(["1024x1024", "1536x1024", "1024x1536", "1792x1024", "1024x1792"]);
const allowedQualities = new Set(["low", "medium", "high"]);
const allowedFormats = new Set(["png", "jpeg", "webp"]);

function readString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readChoice(value, allowed, fallback) {
  const candidate = readString(value);
  return allowed.has(candidate) ? candidate : fallback;
}

function readCount(value) {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue)) {
    return 1;
  }

  // 控制单次生成数量，避免一次请求意外消耗过多额度。
  return Math.min(Math.max(numericValue, 1), 4);
}

export function parseImageRequest(input) {
  const prompt = readString(input?.prompt);
  if (!prompt) {
    throw new Error("请输入图片描述");
  }

  return {
    prompt,
    size: readChoice(input?.size, allowedSizes, "1024x1024"),
    quality: readChoice(input?.quality, allowedQualities, "medium"),
    outputFormat: readChoice(input?.outputFormat, allowedFormats, "png"),
    count: readCount(input?.count)
  };
}

export function buildOpenAIImageRequest(options, model) {
  const payload = {
    model,
    prompt: options.prompt,
    n: options.count,
    size: options.size
  };

  if (model.startsWith("dall-e")) {
    payload.response_format = "b64_json";
    return payload;
  }

  // GPT Image 模型支持质量和输出格式，旧模型则保持最小兼容参数。
  payload.quality = options.quality;
  payload.output_format = options.outputFormat;
  return payload;
}
