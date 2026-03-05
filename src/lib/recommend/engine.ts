import 'server-only';

import type { Album, RecommendedAlbum } from '@/types/domain';

export type ArtistScoreInput = {
  topRank?: number | null;
  recentPlayCount?: number | null;
};

export function computeArtistScore(input: ArtistScoreInput): number {
  const { topRank, recentPlayCount } = input;

  let topWeight = 0;
  if (typeof topRank === 'number' && Number.isFinite(topRank) && topRank > 0) {
    const maxRank = 20;
    const clamped = Math.min(Math.round(topRank), maxRank);
    topWeight = maxRank + 1 - clamped;
  }

  const recent = Math.max(0, Math.floor(recentPlayCount ?? 0));
  const recentComponent = Math.sqrt(recent);

  const score = topWeight * 2 + recentComponent;
  return score;
}

export function computeAlbumScore(artistScore: number, albumReleaseDate: string | Date): number {
  let recencyBonus = 0;

  const release =
    typeof albumReleaseDate === 'string' ? new Date(albumReleaseDate) : albumReleaseDate;

  if (!Number.isNaN(release.getTime())) {
    const now = new Date();
    const ageMs = now.getTime() - release.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays <= 180) {
      recencyBonus = 5;
    } else if (ageDays <= 365) {
      recencyBonus = 3;
    } else if (ageDays <= 3 * 365) {
      recencyBonus = 1;
    }
  }

  return artistScore + recencyBonus;
}

export type TopArtistInput = {
  artistId: string;
  name: string;
  rank: number;
};

export type RecentlyPlayedByArtistInput = {
  artistId: string;
  trackCount: number;
};

export type RankRecommendationsOptions = {
  limit?: number;
};

const SHORT_REASON_MAX_CHARS = 40;

function parseReleaseTime(value: string | Date): number {
  const date = typeof value === 'string' ? new Date(value) : value;
  const time = date.getTime();
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

function releaseAgeDays(value: string | Date): number | null {
  const releaseTime = parseReleaseTime(value);
  if (!Number.isFinite(releaseTime)) return null;
  return (Date.now() - releaseTime) / (1000 * 60 * 60 * 24);
}

function truncateReason(input: string, maxChars = SHORT_REASON_MAX_CHARS): string {
  const normalized = input.replace(/\s+/g, ' ').trim();
  const chars = Array.from(normalized);
  if (chars.length <= maxChars) return normalized;
  if (maxChars <= 3) return chars.slice(0, maxChars).join('');
  return `${chars.slice(0, maxChars - 3).join('')}...`;
}

function buildShortReason(
  artistName: string,
  artistTop: TopArtistInput | undefined,
  recentCount: number,
  albumReleaseDate: string | Date
): string {
  const safeArtistName = artistName?.trim() || 'Unknown artist';
  const ageDays = releaseAgeDays(albumReleaseDate);

  if (recentCount >= 5) {
    return truncateReason(`Nghe nhiều ${safeArtistName}`);
  }

  if (ageDays !== null && ageDays <= 180) {
    return truncateReason(`Album mới: ${safeArtistName}`);
  }

  if (ageDays !== null && ageDays <= 365) {
    return truncateReason('Phát hành gần đây');
  }

  if (artistTop) {
    return truncateReason('Top artist của bạn');
  }

  return truncateReason('Có thể hợp gu bạn');
}

function compareReleaseDateDesc(a: Album, b: Album): number {
  return parseReleaseTime(b.releaseDate) - parseReleaseTime(a.releaseDate);
}

export function rankRecommendations(
  topArtists: TopArtistInput[],
  recentlyPlayed: RecentlyPlayedByArtistInput[],
  candidateAlbums: Album[],
  options: RankRecommendationsOptions = {}
): RecommendedAlbum[] {
  const limit = options.limit ?? 30;

  const topArtistById = new Map<string, TopArtistInput>();
  for (const artist of topArtists) {
    topArtistById.set(artist.artistId, artist);
  }

  const recentByArtistId = new Map<string, number>();
  for (const item of recentlyPlayed) {
    recentByArtistId.set(item.artistId, (recentByArtistId.get(item.artistId) ?? 0) + item.trackCount);
  }

  const deduped = new Map<string, RecommendedAlbum>();

  for (const album of candidateAlbums) {
    const dedupeKey = album.spotifyId || album.id;
    const artistTop = topArtistById.get(album.artistId);
    const recentCount = recentByArtistId.get(album.artistId) ?? 0;

    const artistScore = computeArtistScore({
      topRank: artistTop?.rank,
      recentPlayCount: recentCount,
    });

    const albumScore = computeAlbumScore(artistScore, album.releaseDate);

    const lyDo = buildShortReason(album.artistName, artistTop, recentCount, album.releaseDate);
    const candidate: RecommendedAlbum = {
      album,
      score: albumScore,
      viTri: 0,
      lyDo,
      reason: lyDo,
    };

    const existing = deduped.get(dedupeKey);
    if (!existing) {
      deduped.set(dedupeKey, candidate);
      continue;
    }

    let shouldReplace = false;
    if (candidate.score > existing.score) {
      shouldReplace = true;
    } else if (candidate.score === existing.score) {
      const releaseCmp = compareReleaseDateDesc(candidate.album, existing.album);
      if (releaseCmp < 0) {
        shouldReplace = true;
      } else if (releaseCmp === 0) {
        const nameCmp = candidate.album.name.localeCompare(existing.album.name);
        if (nameCmp < 0) {
          shouldReplace = true;
        } else if (nameCmp === 0) {
          const keyCmp = dedupeKey.localeCompare(existing.album.spotifyId || existing.album.id);
          if (keyCmp < 0) {
            shouldReplace = true;
          }
        }
      }
    }

    if (shouldReplace) {
      deduped.set(dedupeKey, candidate);
    }
  }

  const ranked = Array.from(deduped.values());

  ranked.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const releaseCmp = compareReleaseDateDesc(a.album, b.album);
    if (releaseCmp !== 0) {
      return releaseCmp;
    }
    if (a.album.name !== b.album.name) {
      return a.album.name.localeCompare(b.album.name);
    }
    if (a.album.spotifyId !== b.album.spotifyId) {
      return a.album.spotifyId.localeCompare(b.album.spotifyId);
    }
    return a.album.id.localeCompare(b.album.id);
  });

  return ranked.slice(0, limit).map((item, index) => ({
    ...item,
    viTri: index + 1,
  }));
}

