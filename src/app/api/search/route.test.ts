import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

vi.mock('@/server/clients/coverart', () => ({ getCoverArtUrlForReleaseGroup: vi.fn().mockResolvedValue(null) }));
vi.mock('@/server/clients/musicbrainz', () => ({
  searchAlbumsWithCache: vi.fn().mockResolvedValue([
    { mbid: 'mb-1', title: 'Album', artistName: 'Artist', releaseYear: 2000, coverUrl: null, artistMbid: null },
  ]),
}));

function request(url: string): NextRequest {
  return new NextRequest(url);
}

describe('GET /api/search', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 and candidates when q is valid (min 2 chars)', async () => {
    const res = await GET(request('https://x/api/search?q=ab'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.candidates).toBeDefined();
    expect(Array.isArray(json.candidates)).toBe(true);
    expect(json.meta).toEqual({ query: 'ab', count: 1 });
  });

  it('returns 400 validation_error when q is missing', async () => {
    const res = await GET(request('https://x/api/search'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe('validation_error');
  });

  it('returns 400 validation_error when q is too short', async () => {
    const res = await GET(request('https://x/api/search?q=a'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe('validation_error');
  });

  it('accepts optional limit within range', async () => {
    const res = await GET(request('https://x/api/search?q=hello&limit=5'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.meta.query).toBe('hello');
  });
});
