/**
 * POST /api/onboarding/favorites
 * Save selected albums and optional preferred artists/genres during onboarding.
 * Body: { selectedAlbums, preferredArtists?, preferredGenres? } (Zod-validated).
 */
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/guard';
import { onboardingFavoritesBodySchema } from '@/lib/validation/schemas';
import { parseWithSchema } from '@/lib/validation/parse';
import { internalError } from '@/lib/api/errors';
import { saveOnboardingFavorites } from '@/server/services/onboardingFavorites.service';
import type { OnboardingFavoritesResponseDTO } from '@/lib/dto';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const userId = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const parsed = parseWithSchema(onboardingFavoritesBodySchema, {});
    if (parsed.ok === false) return parsed.response;
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }
  const parsed = parseWithSchema(onboardingFavoritesBodySchema, body);
  if (parsed.ok === false) return parsed.response;

  try {
    const result = await saveOnboardingFavorites(userId, parsed.data);
    const dto: OnboardingFavoritesResponseDTO = {
      ok: true,
      selectedCount: result.selectedCount,
      preferredArtistsCount: result.preferredArtistsCount,
      preferredGenresCount: result.preferredGenresCount,
    };
    return Response.json(dto);
  } catch (err) {
    console.error('[api/onboarding/favorites]', err);
    return internalError();
  }
}
