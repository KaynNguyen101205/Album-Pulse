import 'server-only';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getReleaseGroupWithCache } from '@/server/clients/musicbrainz';
import { getCoverArtUrlForReleaseGroup } from '@/server/clients/coverart';
import { normalizeAlbum } from '@/server/normalizers/albumNormalizer';
import type { OnboardingFavoritesBody } from '@/lib/validation/schemas';

/**
 * Ensure artist exists; return artist id.
 */
async function ensureArtist(mbid: string | null, name: string): Promise<string> {
  const id = randomUUID();
  if (mbid?.trim()) {
    const existing = await prisma.artist.findUnique({ where: { mbid } });
    if (existing) return existing.id;
    await prisma.artist.create({ data: { id, mbid, name } });
    return id;
  }
  const existing = await prisma.artist.findFirst({ where: { name } });
  if (existing) return existing.id;
  await prisma.artist.create({ data: { id, name } });
  return id;
}

/**
 * Ensure album exists (by mbid or create from payload); return album id.
 */
async function ensureAlbum(payload: {
  mbid: string;
  title: string;
  artistId: string;
  releaseYear: number | null;
  coverUrl: string | null;
}): Promise<string> {
  const existing = await prisma.album.findUnique({ where: { mbid: payload.mbid } });
  if (existing) return existing.id;
  const album = await prisma.album.create({
    data: {
      id: randomUUID(),
      mbid: payload.mbid,
      title: payload.title,
      artistId: payload.artistId,
      releaseYear: payload.releaseYear,
      coverUrl: payload.coverUrl,
      source: 'MUSICBRAINZ',
    },
  });
  return album.id;
}

function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);
}

/**
 * Save onboarding favorites for the user. Creates albums from MusicBrainz when mbid is provided and album missing.
 */
export async function saveOnboardingFavorites(
  userId: string,
  body: OnboardingFavoritesBody
): Promise<{ selectedCount: number; preferredArtistsCount: number; preferredGenresCount: number }> {
  const addedAlbumIds = new Set<string>();
  for (const item of body.selectedAlbums) {
    const mbid = item.mbid?.trim() || null;
    const title = item.title.trim();
    const artistName = item.artistName.trim();
    const releaseYear =
      item.releaseYear != null && item.releaseYear >= 1000 && item.releaseYear <= 9999
        ? item.releaseYear
        : null;
    const coverUrl = item.coverUrl?.trim() || null;

    let albumId: string;
    if (mbid) {
      let album = await prisma.album.findUnique({ where: { mbid } });
      if (!album) {
        const rg = await getReleaseGroupWithCache(mbid);
        if (!rg) continue;
        const artistNameMb = rg['artist-credit']?.[0]?.name ?? artistName;
        const cover = await getCoverArtUrlForReleaseGroup(mbid);
        const norm = normalizeAlbum(rg, { coverUrl: cover ?? undefined });
        const artistId = await ensureArtist(
          rg['artist-credit']?.[0]?.artist?.id ?? null,
          artistNameMb
        );
        albumId = await ensureAlbum({
          mbid,
          title: norm.title,
          artistId,
          releaseYear: norm.releaseYear,
          coverUrl: norm.coverUrl,
        });
      } else {
        albumId = album.id;
      }
    } else {
      const manualMbid = `manual:${slugify(title)}:${slugify(artistName)}:${releaseYear ?? 'na'}`;
      let album = await prisma.album.findUnique({ where: { mbid: manualMbid } });
      if (!album) {
        const artistId = await ensureArtist(null, artistName);
        albumId = await ensureAlbum({
          mbid: manualMbid,
          title,
          artistId,
          releaseYear,
          coverUrl,
        });
      } else {
        albumId = album.id;
      }
    }
    addedAlbumIds.add(albumId);
    await prisma.userFavoriteAlbum.upsert({
      where: {
        userId_albumId: { userId, albumId },
      },
      create: {
        id: randomUUID(),
        userId,
        albumId,
      },
      update: {},
    });
  }
  return {
    selectedCount: addedAlbumIds.size,
    preferredArtistsCount: body.preferredArtists?.length ?? 0,
    preferredGenresCount: body.preferredGenres?.length ?? 0,
  };
}
