import 'server-only';

import type {
  MusicBrainzReleaseGroupResponse,
  MusicBrainzReleaseGroup,
} from '@/server/clients/musicbrainz';
import type { LastfmAlbumInfo, LastfmTag } from '@/server/clients/lastfm';

export type Popularity = {
  listeners: number | null;
  playcount: number | null;
  score: number | null;
};

export type AlbumDTO = {
  mbid: string;
  title: string;
  artistName: string;
  artistMbid: string | null;
  releaseYear: number | null;
  tags: string[];
  coverUrl: string | null;
  description: string;
  popularity: Popularity;
};

function extractYearFromReleaseGroup(
  rg: MusicBrainzReleaseGroup | MusicBrainzReleaseGroupResponse
): number | null {
  const fromRg = rg['first-release-date'];
  if (fromRg) {
    const year = Number(fromRg.slice(0, 4));
    if (Number.isFinite(year)) return year;
  }
  const maybeReleases = (rg as MusicBrainzReleaseGroupResponse).releases;
  const firstRelease = maybeReleases?.[0];
  if (firstRelease?.date) {
    const year = Number(firstRelease.date.slice(0, 4));
    if (Number.isFinite(year)) return year;
  }
  return null;
}

function pickTags(
  mbTags?: Array<{ name?: string }>,
  lfTags?: LastfmTag[] | undefined
): string[] {
  const set = new Set<string>();
  for (const t of mbTags ?? []) {
    if (!t?.name) continue;
    set.add(t.name.toLowerCase());
  }
  for (const t of lfTags ?? []) {
    if (!t?.name) continue;
    set.add(t.name.toLowerCase());
  }
  return Array.from(set);
}

function computePopularityScore(
  listeners: number | null,
  playcount: number | null
): number | null {
  const l = listeners ?? 0;
  const p = playcount ?? 0;
  const raw = Math.max(l, p);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const max = 10_000_000;
  const score = Math.min(1, Math.log1p(raw) / Math.log1p(max));
  return score;
}

function parseIntOrNull(value?: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeAlbum(
  rg: MusicBrainzReleaseGroupResponse,
  options: {
    lastfmAlbum?: LastfmAlbumInfo | null;
    coverUrl?: string | null;
  } = {}
): AlbumDTO {
  const artistCredit = rg['artist-credit']?.[0];
  const artistName = artistCredit?.name ?? '';
  const artistMbid = artistCredit?.artist?.id ?? null;

  const lfAlbum = options.lastfmAlbum;
  const lfTags =
    lfAlbum?.toptags?.tag ??
    lfAlbum?.tags?.tag ??
    undefined;

  const listeners = parseIntOrNull(lfAlbum?.listeners);
  const playcount = parseIntOrNull(lfAlbum?.playcount);

  const popularity: Popularity = {
    listeners,
    playcount,
    score: computePopularityScore(listeners, playcount),
  };

  const tags = pickTags(rg.tags, lfTags);
  const releaseYear = extractYearFromReleaseGroup(rg);

  return {
    mbid: rg.id,
    title: rg.title,
    artistName,
    artistMbid,
    releaseYear,
    tags,
    coverUrl: options.coverUrl ?? null,
    description: '', // Phase 2: optional Wikipedia/extra text
    popularity,
  };
}

