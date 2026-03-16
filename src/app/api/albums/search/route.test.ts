import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { GET } from './route';

const mockSearchAlbumsWithCache = vi.fn();
const mockGetCoverArtUrlForReleaseGroup = vi.fn();

vi.mock('@/server/clients/musicbrainz', () => ({
  searchAlbumsWithCache: (...args: unknown[]) => mockSearchAlbumsWithCache(...args),
}));

vi.mock('@/server/clients/coverart', () => ({
  getCoverArtUrlForReleaseGroup: (...args: unknown[]) => mockGetCoverArtUrlForReleaseGroup(...args),
}));

function request(url: string): NextRequest {
  return new NextRequest(url);
}

describe('GET /api/albums/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchAlbumsWithCache.mockResolvedValue([
      {
        mbid: 'mb-1',
        title: 'Album',
        artistName: 'Artist',
        artistMbid: null,
        releaseYear: 2000,
        tags: [],
        coverUrl: null,
      },
    ]);
  });

  it('returns 400 validation_error when q is missing', async () => {
    const res = await GET(request('https://x/api/albums/search'));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe('validation_error');
  });

  it('returns 400 validation_error when q is too short', async () => {
    const res = await GET(request('https://x/api/albums/search?q=a'));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe('validation_error');
  });

  it('returns candidates without requesting cover art in the search path', async () => {
    const res = await GET(request('https://x/api/albums/search?q=ab'));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.meta).toEqual({ query: 'ab', count: 1 });
    expect(mockSearchAlbumsWithCache).toHaveBeenCalledWith('ab', { limit: 10 });
    expect(mockGetCoverArtUrlForReleaseGroup).not.toHaveBeenCalled();
  });

  it('accepts an optional limit', async () => {
    const res = await GET(request('https://x/api/albums/search?q=hello&limit=5'));

    expect(res.status).toBe(200);
    expect(mockSearchAlbumsWithCache).toHaveBeenCalledWith('hello', { limit: 5 });
  });
});
