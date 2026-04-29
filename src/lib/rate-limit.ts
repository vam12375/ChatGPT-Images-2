type ClientWindow = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export type MemoryRateLimiterOptions = {
  maxRequests: number;
  windowMs: number;
  now?: () => number;
};

export type MemoryRateLimiter = {
  check(identifier: string): RateLimitResult;
  clear(): void;
};

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0
    ? numericValue
    : fallback;
}

export function readRateLimitConfig(
  env: Record<string, string | undefined> = process.env
): MemoryRateLimiterOptions {
  return {
    maxRequests: readPositiveInteger(env.IMAGE_RATE_LIMIT_MAX, 10),
    windowMs: readPositiveInteger(env.IMAGE_RATE_LIMIT_WINDOW_MS, 60_000)
  };
}

export function createMemoryRateLimiter(
  options: MemoryRateLimiterOptions
): MemoryRateLimiter {
  const clients = new Map<string, ClientWindow>();
  const now = options.now ?? Date.now;

  return {
    check(identifier: string): RateLimitResult {
      const currentTime = now();
      const currentWindow = clients.get(identifier);

      if (!currentWindow || currentTime >= currentWindow.resetAt) {
        clients.set(identifier, {
          count: 1,
          resetAt: currentTime + options.windowMs
        });

        return {
          allowed: true,
          remaining: Math.max(options.maxRequests - 1, 0),
          retryAfterMs: 0
        };
      }

      if (currentWindow.count >= options.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: Math.max(currentWindow.resetAt - currentTime, 0)
        };
      }

      currentWindow.count += 1;

      return {
        allowed: true,
        remaining: Math.max(options.maxRequests - currentWindow.count, 0),
        retryAfterMs: 0
      };
    },

    clear(): void {
      clients.clear();
    }
  };
}

export function readClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim() || "local";
  }

  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "local"
  );
}
