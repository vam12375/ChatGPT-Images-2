type ErrorWithStatus = {
  status?: number;
  message?: string;
};

type RetryOptions = {
  maxAttempts?: number;
  onRetry?: (delayMs: number, attempt: number, error: unknown) => void;
  wait?: (delayMs: number) => Promise<void>;
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

function defaultWait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function shouldRetryOpenAIError(error: unknown): boolean {
  const status = readErrorStatus(error);

  if (status === undefined) {
    return true;
  }

  return status === 429 || (status >= 500 && status < 600);
}

export async function callOpenAIWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const onRetry =
    options.onRetry ??
    ((delayMs: number, attempt: number, error: unknown) => {
      console.warn(
        `OpenAI API 调用失败（尝试 ${attempt}/${maxAttempts}），${delayMs}ms 后重试`,
        readErrorMessage(error)
      );
    });
  const wait = options.wait ?? defaultWait;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // 只重试限流、服务端错误和网络类未知错误，避免参数错误反复消耗时间。
      if (!shouldRetryOpenAIError(error)) {
        throw error;
      }

      if (attempt < maxAttempts) {
        const delayMs = 2 ** (attempt - 1) * 1000;
        onRetry(delayMs, attempt, error);
        await wait(delayMs);
      }
    }
  }

  throw lastError;
}
