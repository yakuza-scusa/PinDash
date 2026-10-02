const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function csrfAllowed(input: {
  method: string;
  url: string;
  origin: string | undefined;
  cookie: string | undefined;
  webUrl: string;
  cookieName: string | undefined;
}): boolean {
  if (!MUTATIONS.has(input.method)) return true;
  if (input.url.startsWith("/api/v1/internal/")) return true;
  if (!input.cookie?.includes(`${input.cookieName ?? "pindash_session"}=`))
    return true;
  const origin = input.origin ? normalizeOrigin(input.origin) : null;
  const webOrigin = normalizeOrigin(input.webUrl);
  return origin !== null && webOrigin !== null && origin === webOrigin;
}

export class RequestRateLimiter {
  private readonly buckets = new Map<
    string,
    { count: number; resetAt: number }
  >();
  constructor(
    private readonly limit = 120,
    private readonly windowMs = 60_000,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= this.limit;
  }
}
