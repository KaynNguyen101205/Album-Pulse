import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { DELETE, POST } from './route';

const mockRequireSession = vi.fn();
const mockAlbumFindUnique = vi.fn();
const mockFavoriteCreate = vi.fn();
const mockFavoriteDeleteMany = vi.fn();

vi.mock('@/lib/session', () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    album: {
      findUnique: (...args: unknown[]) => mockAlbumFindUnique(...args),
    },
    userFavoriteAlbum: {
      create: (...args: unknown[]) => mockFavoriteCreate(...args),
      deleteMany: (...args: unknown[]) => mockFavoriteDeleteMany(...args),
    },
  },
}));

describe('/api/favorites route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue('user-1');
    mockFavoriteCreate.mockResolvedValue({ id: 'fav-1' });
    mockFavoriteDeleteMany.mockResolvedValue({ count: 1 });
  });

  it('accepts raw MusicBrainz mbid values from dashboard when saving favorites', async () => {
    mockAlbumFindUnique.mockResolvedValueOnce({ id: 'album-1', mbid: 'mbid-1' });

    const res = await POST(
      new NextRequest('https://x/api/favorites', {
        method: 'POST',
        body: JSON.stringify({ albumSpotifyId: 'mbid-1' }),
      })
    );

    expect(res.status).toBe(200);
    expect(mockAlbumFindUnique).toHaveBeenCalledWith({ where: { mbid: 'mbid-1' } });
    expect(mockFavoriteCreate).toHaveBeenCalledWith({
      data: { id: expect.any(String), userId: 'user-1', albumId: 'album-1' },
    });
  });

  it('accepts mb: prefixed ids when removing favorites', async () => {
    mockAlbumFindUnique.mockResolvedValueOnce({ id: 'album-1', mbid: 'mbid-1' });

    const res = await DELETE(
      new NextRequest('https://x/api/favorites?albumSpotifyId=mb%3Ambid-1', {
        method: 'DELETE',
      })
    );

    expect(res.status).toBe(200);
    expect(mockAlbumFindUnique).toHaveBeenCalledWith({ where: { mbid: 'mbid-1' } });
    expect(mockFavoriteDeleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', albumId: 'album-1' },
    });
  });

  it('falls back to spotify-prefixed lookup for legacy spotify ids', async () => {
    mockAlbumFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'album-2', mbid: 'spotify:sp-123' });

    const res = await POST(
      new NextRequest('https://x/api/favorites', {
        method: 'POST',
        body: JSON.stringify({ albumSpotifyId: 'sp-123' }),
      })
    );

    expect(res.status).toBe(200);
    expect(mockAlbumFindUnique).toHaveBeenNthCalledWith(1, { where: { mbid: 'sp-123' } });
    expect(mockAlbumFindUnique).toHaveBeenNthCalledWith(2, { where: { mbid: 'spotify:sp-123' } });
  });
});
