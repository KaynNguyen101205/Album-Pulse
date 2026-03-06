import 'server-only';

import { setTimeout as sleep } from 'timers/promises';

export type SourceName = 'musicbrainz' | 'lastfm' | 'coverart' | string;

type FetchOptions = RequestInit & {
  maxRetries?: number;
};

type FetchMeta = {
  source: SourceName;
  endpoint: string;
};

type Metrics = {
  requestCountBySource: Record<string, number>;
  errorCountBySource: Record<string, number>;
};

const HOST_MIN_INTERVAL_MS: Record<string, number> = {
  'musicbrainz.org': 1000, // ~1 req/sec
};

const hostLastRequestAt = new Map<string, number>();

const metrics: Metrics = {
  requestCountBySource: {},
  errorCountBySource: {},
};

export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly source: SourceName,
    public readonly endpoint: string,
    public readonly status: number,
    public readonly retryAfterSeconds?: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

async function applyRateLimit(url: string): Promise<void> {
  const host = new URL(url).hostname;
  const minInterval = HOST_MIN_INTERVAL_MS[host];
  if (!minInterval) return;

  const now = Date.now();
  const last = hostLastRequestAt.get(host) ?? 0;
  const elapsed = now - last;
  if (elapsed < minInterval) {
    await sleep(minInterval - elapsed);
  }
  hostLastRequestAt.set(host, Date.now());
}

function recordMetrics(source: SourceName, ok: boolean) {
  metrics.requestCountBySource[source] = (metrics.requestCountBySource[source] ?? 0) + 1;
  if (!ok) {
    metrics.errorCountBySource[source] = (metrics.errorCountBySource[source] ?? 0) + 1;
  }
}

function parseRetryAfterSeconds(res: Response): number | undefined {
  const header = res.headers.get('retry-after');
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds;
  const date = new Date(header).getTime();
  if (Number.isNaN(date)) return undefined;
  const diffMs = date - Date.now();
  return diffMs > 0 ? Math.ceil(diffMs / 1000) : undefined;
}

export async function fetchJsonWithRetry<T>(
  url: string,
  init: FetchOptions,
  meta: FetchMeta
): Promise<{ data: T; status: number }> {
  const { source, endpoint } = meta;
  const maxRetries = init.maxRetries ?? 3;
  const baseDelayMs = 500;
  const maxDelayMs = 4000;

  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await applyRateLimit(url);
    const start = Date.now();
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      const durationMs = Date.now() - start;
      recordMetrics(source, false);
      console.error('[http] network_error', {
        source,
        endpoint,
        url,
        durationMs,
        attempt,
        error: String(err),
      });

      if (attempt >= maxRetries) {
        throw new UpstreamError('network_error', source, endpoint, 0, undefined, String(err));
      }
      attempt += 1;
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await sleep(delay + Math.random() * 200);
      continue;
    }

    const durationMs = Date.now() - start;
    const status = res.status;
    const ok = status >= 200 && status < 300;
    recordMetrics(source, ok);

    console.info('[http]', {
      source,
      endpoint,
      url,
      status,
      durationMs,
      attempt,
    });

    if (ok) {
      const data = (await res.json()) as T;
      return { data, status };
    }

    const retryable = status === 429 || (status >= 500 && status < 600);
    const retryAfterSeconds = parseRetryAfterSeconds(res);
    const bodyText = await res.text().catch(() => undefined);

    if (!retryable || attempt >= maxRetries) {
      throw new UpstreamError(
        `upstream_error_${status}`,
        source,
        endpoint,
        status,
        retryAfterSeconds,
        bodyText
      );
    }

    attempt += 1;
    let delayMs: number;
    if (retryAfterSeconds && retryAfterSeconds > 0) {
      delayMs = retryAfterSeconds * 1000;
    } else {
      delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
    }
    await sleep(delayMs + Math.random() * 200);
  }
}

export function getHttpMetrics(): Metrics {
  return metrics;
}

