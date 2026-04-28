export type FormattedOpenAIError = {
  status: number;
  message: string;
};

type ErrorRecord = Record<string, unknown>;

function asRecord(value: unknown): ErrorRecord {
  return value && typeof value === "object" ? (value as ErrorRecord) : {};
}

function readNestedMessage(error: unknown): string {
  const root = asRecord(error);
  const response = asRecord(root.response);
  const data = asRecord(response.data);
  const dataError = asRecord(data.error);
  const directError = asRecord(root.error);

  return (
    (typeof dataError.message === "string" && dataError.message) ||
    (typeof directError.message === "string" && directError.message) ||
    (typeof root.message === "string" && root.message) ||
    ""
  );
}

export function formatOpenAIError(error: unknown): FormattedOpenAIError {
  const message = readNestedMessage(error);

  if (/billing hard limit/i.test(message)) {
    return {
      status: 402,
      message:
        "OpenAI 账单硬上限已达到。请到 OpenAI 控制台检查账户余额、月度限额或付款方式后再生成图片。"
    };
  }

  return {
    status: 502,
    message: message || "图片生成失败，请稍后重试"
  };
}
