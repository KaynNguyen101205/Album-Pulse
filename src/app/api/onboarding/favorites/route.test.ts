import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const mockSave = vi.fn();
vi.mock('@/server/services/onboardingFavorites.service', () => ({
  saveOnboardingFavorites: (...args: unknown[]) => mockSave(...args),
}));
vi.mock('@/lib/auth/guard', () => ({
  requireAuth: vi.fn().mockResolvedValue('user-1'),
}));

describe('POST /api/onboarding/favorites', () => {
  beforeEach(() => mockSave.mockResolvedValue({ selectedCount: 1, preferredArtistsCount: 0, preferredGenresCount: 0 }));

  function request(body: unknown): NextRequest {
    return new NextRequest('https://x/api/onboarding/favorites', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  it('returns 400 validation_error when body is invalid (no selectedAlbums)', async () => {
    const res = await POST(request({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe('validation_error');
  });

  it('returns 400 when required album fields missing', async () => {
    const res = await POST(request({
      selectedAlbums: [{ title: '', artistName: 'Artist' }],
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe('validation_error');
  });

  it('returns 200 and DTO when body is valid', async () => {
    const res = await POST(request({
      selectedAlbums: [{ title: 'Album', artistName: 'Artist' }],
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(typeof json.selectedCount).toBe('number');
  });
});
