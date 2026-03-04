import 'server-only';
import { prisma } from '@/lib/prisma';
import type { TokenResponse } from '@/lib/spotify/oauth';
import type { SpotifyMeProfile } from '@/lib/spotify/oauth';

export async function upsertUserAndTokens(
  profile: SpotifyMeProfile,
  tokens: TokenResponse
): Promise<string> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const imageUrl = profile.images?.[0]?.url ?? null;

  const nguoiDung = await prisma.nguoiDung.upsert({
    where: { spotifyId: profile.id },
    create: {
      spotifyId: profile.id,
      tenHienThi: profile.display_name ?? null,
      email: profile.email ?? null,
      anhDaiDienUrl: imageUrl,
      quocGia: profile.country ?? null,
      product: profile.product ?? null,
    },
    update: {
      tenHienThi: profile.display_name ?? null,
      email: profile.email ?? null,
      anhDaiDienUrl: imageUrl,
      quocGia: profile.country ?? null,
      product: profile.product ?? null,
    },
    select: { id: true },
  });

  const tokenData = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? '',
    expiresAt,
    scope: tokens.scope ?? null,
    tokenType: tokens.token_type ?? null,
  };

  await prisma.oAuthToken.upsert({
    where: { nguoiDungId: nguoiDung.id },
    create: {
      nguoiDungId: nguoiDung.id,
      ...tokenData,
    },
    update: {
      accessToken: tokens.access_token,
      expiresAt,
      scope: tokens.scope ?? null,
      tokenType: tokens.token_type ?? null,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    },
  });

  return nguoiDung.id;
}
