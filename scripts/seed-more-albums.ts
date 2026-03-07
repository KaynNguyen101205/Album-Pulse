import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import {
  searchAlbumsWithCache,
  getReleaseGroupWithCache,
} from '@/server/clients/musicbrainz';
import { getCoverArtUrlForReleaseGroup } from '@/server/clients/coverart';
import { randomUUID } from 'crypto';

const SEARCH_QUERIES = [
  'Pink Floyd The Wall',
  'Muse Origin of Symmetry',
  'Portishead Dummy',
  'The Strokes Is This It',
  'Björk Homogenic',
  'Massive Attack Mezzanine',
  'Tame Impala Currents',
];

async function ensureArtist(
  mbid: string | null,
  name: string
): Promise<string> {
  const id = randomUUID();
  if (mbid?.trim()) {
    const existing = await prisma.artist.findUnique({
      where: { mbid },
    });
    if (existing) return existing.id;
    await prisma.artist.create({
      data: { id, mbid, name },
    });
    return id;
  }
  const existing = await prisma.artist.findFirst({
    where: { name },
  });
  if (existing) return existing.id;
  await prisma.artist.create({
    data: { id, name },
  });
  return id;
}

async function ensureTag(name: string): Promise<string> {
  const n = name.trim().toLowerCase();
  if (!n) throw new Error('Empty tag name');
  const tag = await prisma.tag.upsert({
    where: { name: n },
    create: { id: randomUUID(), name: n },
    update: {},
  });
  return tag.id;
}

async function ensureAlbum(payload: {
  mbid: string;
  title: string;
  artistId: string;
  releaseYear: number | null;
  coverUrl: string | null;
  tags: string[];
}): Promise<string> {
  const album = await prisma.album.upsert({
    where: { mbid: payload.mbid },
    create: {
      id: randomUUID(),
      mbid: payload.mbid,
      title: payload.title,
      artistId: payload.artistId,
      releaseYear: payload.releaseYear,
      coverUrl: payload.coverUrl,
      source: 'MUSICBRAINZ',
    },
    update: {
      title: payload.title,
      artistId: payload.artistId,
      releaseYear: payload.releaseYear,
      coverUrl: payload.coverUrl,
    },
  });
  for (const tagName of payload.tags) {
    try {
      const tagId = await ensureTag(tagName);
      await prisma.albumTag.upsert({
        where: {
          albumId_tagId: { albumId: album.id, tagId },
        },
        create: { albumId: album.id, tagId },
        update: {},
      });
    } catch {
      // skip invalid tag
    }
  }
  return album.id;
}

async function main() {
  let added = 0;
  const seenMbids = new Set<string>();

  for (const query of SEARCH_QUERIES) {
    const candidates = await searchAlbumsWithCache(query, {
      limit: 5,
      getCoverUrl: getCoverArtUrlForReleaseGroup,
    });

    for (const c of candidates) {
      if (!c.mbid?.trim() || seenMbids.has(c.mbid)) continue;
      seenMbids.add(c.mbid);

      const rg = await getReleaseGroupWithCache(c.mbid);
      if (!rg) continue;

      const artistName = rg['artist-credit']?.[0]?.name ?? c.artistName;
      const artistMbid = rg['artist-credit']?.[0]?.artist?.id ?? null;
      const releaseYear =
        rg['first-release-date'] != null
          ? parseInt(rg['first-release-date'].slice(0, 4), 10)
          : null;
      const tagNames =
        rg.tags?.map((t) => t.name?.toLowerCase().trim()).filter(Boolean) ?? [];
      const coverUrl = c.coverUrl ?? null;

      const artistId = await ensureArtist(artistMbid, artistName);
      await ensureAlbum({
        mbid: c.mbid,
        title: rg.title,
        artistId,
        releaseYear: Number.isFinite(releaseYear) ? releaseYear : null,
        coverUrl,
        tags: [...new Set(tagNames)],
      });
      added += 1;
      console.log(`  + ${rg.title} — ${artistName}`);
    }
  }

  console.log(`\nAdded/updated ${added} albums. Run: npm run embed:albums`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
