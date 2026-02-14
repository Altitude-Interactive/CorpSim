type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const valueCache = new Map<string, CacheEntry>();
const inflightCache = new Map<string, Promise<unknown>>();

export interface CachedRequestOptions {
  force?: boolean;
}

export async function getCachedRequest<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  options: CachedRequestOptions = {}
): Promise<T> {
  if (options.force) {
    invalidateCachedRequest(key);
  }

  const now = Date.now();
  const cached = valueCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const inflight = inflightCache.get(key);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const request = fetcher()
    .then((value) => {
      valueCache.set(key, {
        value,
        expiresAt: Date.now() + Math.max(0, ttlMs)
      });
      return value;
    })
    .finally(() => {
      inflightCache.delete(key);
    });

  inflightCache.set(key, request as Promise<unknown>);
  return request;
}

export function invalidateCachedRequest(key: string): void {
  valueCache.delete(key);
  inflightCache.delete(key);
}

export function invalidateCachedRequestPrefix(prefix: string): void {
  for (const key of valueCache.keys()) {
    if (key.startsWith(prefix)) {
      valueCache.delete(key);
    }
  }

  for (const key of inflightCache.keys()) {
    if (key.startsWith(prefix)) {
      inflightCache.delete(key);
    }
  }
}
