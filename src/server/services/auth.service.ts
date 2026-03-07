import 'server-only';
import { prisma } from '@/lib/prisma';
import type { TokenResponse } from '@/lib/spotify/oauth';
import type { SpotifyMeProfile } from '@/lib/spotify/oauth';

export async function upsertUserAndTokens(
  profile: SpotifyMeProfile,
  tokens: TokenResponse
): Promise<string> {
  void tokens;
  const imageUrl = profile.images?.[0]?.url ?? null;

  const user = await prisma.user.upsert({
    where: { id: profile.id },
    create: {
      id: profile.id,
      name: profile.display_name ?? null,
      email: profile.email ?? null,
      image: imageUrl,
    },
    update: {
      name: profile.display_name ?? null,
      email: profile.email ?? null,
      image: imageUrl,
    },
    select: { id: true },
  });

  return user.id;
}
