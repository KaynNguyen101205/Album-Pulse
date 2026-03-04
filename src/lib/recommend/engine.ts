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
    const artistTop = topArtistById.get(album.artistId);
    const recentCount = recentByArtistId.get(album.artistId) ?? 0;

    const artistScore = computeArtistScore({
      topRank: artistTop?.rank,
      recentPlayCount: recentCount,
    });

    const albumScore = computeAlbumScore(artistScore, album.releaseDate);

    const existing = deduped.get(album.id);
    if (existing && existing.score >= albumScore) {
      continue;
    }

    const ageReasonPart =
      (() => {
        const release = new Date(album.releaseDate);
        if (Number.isNaN(release.getTime())) return '';

        const now = new Date();
        const ageMs = now.getTime() - release.getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);

        if (ageDays <= 180) return 'New release';
        if (ageDays <= 365) return 'Recent release';
        return '';
      })() || null;

    let reason: string;
    if (recentCount >= 5) {
      reason = `Because you frequently listen to ${album.artistName}`;
    } else if (ageReasonPart) {
      reason = `${ageReasonPart} from ${album.artistName}`;
    } else if (artistTop) {
      reason = `Because ${album.artistName} is one of your top artists`;
    } else {
      reason = `Because you might like ${album.artistName}`;
    }

    deduped.set(album.id, {
      album,
      score: albumScore,
      reason,
    });
  }

  const ranked = Array.from(deduped.values());

  ranked.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.album.name !== b.album.name) {
      return a.album.name.localeCompare(b.album.name);
    }
    return a.album.id.localeCompare(b.album.id);
  });

  return ranked.slice(0, limit);
}

