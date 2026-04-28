function readMessage(error) {
  return (
    error?.response?.data?.error?.message ||
    error?.error?.message ||
    error?.message ||
    ""
  );
}

export function formatOpenAIError(error) {
  const message = readMessage(error);

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
