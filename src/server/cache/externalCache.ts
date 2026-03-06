import 'server-only';

import { prisma } from '@/lib/prisma';

type CacheSource = 'musicbrainz' | 'lastfm' | 'coverart' | string;

type MemoryEntry = {
  value: unknown;
  expiresAt: number;
  createdAt: number;
};

const memoryCache = new Map<string, MemoryEntry>();
const MAX_MEMORY_ENTRIES = 500;

let memoryHits = 0;
let memoryMisses = 0;
let persistentHits = 0;
let persistentMisses = 0;

function now(): number {
  return Date.now();
}

function setMemory(key: string, value: unknown, ttlSeconds: number): void {
  const createdAt = now();
  const expiresAt = createdAt + ttlSeconds * 1000;

  memoryCache.set(key, { value, createdAt, expiresAt });

  if (memoryCache.size > MAX_MEMORY_ENTRIES) {
    // Evict oldest entry
    let oldestKey: string | null = null;
    let oldestCreatedAt = Number.POSITIVE_INFINITY;
    memoryCache.forEach((entry, k) => {
      if (entry.createdAt < oldestCreatedAt) {
        oldestCreatedAt = entry.createdAt;
        oldestKey = k;
      }
    });
    if (oldestKey) {
      memoryCache.delete(oldestKey);
    }
  }
}

export async function getCache<T = unknown>(key: string): Promise<T | null> {
  const entry = memoryCache.get(key);
  if (entry) {
    if (entry.expiresAt > now()) {
      memoryHits += 1;
      console.info('[cache] hit (memory)', { key });
      return entry.value as T;
    }
    memoryCache.delete(key);
  } else {
    memoryMisses += 1;
  }

  const dbEntry = await prisma.externalCache.findUnique({
    where: { key },
  });

  if (!dbEntry) {
    persistentMisses += 1;
    console.info('[cache] miss (db)', { key });
    return null;
  }

  if (dbEntry.expiresAt <= new Date()) {
    // Expired: best-effort cleanup
    void prisma.externalCache
      .delete({ where: { key } })
      .catch(() => {
        // ignore cleanup errors
      });
    persistentMisses += 1;
    console.info('[cache] expired (db)', { key });
    return null;
  }

  persistentHits += 1;
  console.info('[cache] hit (db)', { key, source: dbEntry.source });

  // Rehydrate memory cache
  setMemory(key, dbEntry.payloadJson, dbEntry.ttlSeconds);

  return dbEntry.payloadJson as T;
}

export async function setCache(
  key: string,
  payload: unknown,
  ttlSeconds: number,
  source: CacheSource
): Promise<void> {
  const expiresAt = new Date(now() + ttlSeconds * 1000);

  await prisma.externalCache.upsert({
    where: { key },
    create: {
      key,
      payloadJson: payload as unknown as object,
      source,
      ttlSeconds,
      expiresAt,
    },
    update: {
      payloadJson: payload as unknown as object,
      source,
      ttlSeconds,
      expiresAt,
    },
  });

  setMemory(key, payload, ttlSeconds);
}

export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  source: CacheSource,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  const value = await fetcher();
  try {
    await setCache(key, value, ttlSeconds, source);
  } catch (err) {
    console.error('[cache] failed to persist', { key, source, error: err });
  }
  return value;
}

export function getCacheMetrics() {
  return {
    memoryHits,
    memoryMisses,
    persistentHits,
    persistentMisses,
    size: memoryCache.size,
  };
}
