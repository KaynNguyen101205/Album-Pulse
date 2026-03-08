import { FEEDBACK_LOOP_CONFIG } from './config';
import { normalizeToken } from './feedback-weights';

export function isAlbumInCooldown(
  albumId: string,
  recentlyRecommendedAlbumIds: Set<string>
): boolean {
  return recentlyRecommendedAlbumIds.has(albumId);
}

export function isArtistOverRepeatCap(
  artistNameOrId: string,
  recentArtistCounts: Record<string, number>,
  cap: number = FEEDBACK_LOOP_CONFIG.artistRepeatCapInWindow
): boolean {
  const key = normalizeToken(artistNameOrId);
  if (!key) return false;
  return (recentArtistCounts[key] ?? 0) >= cap;
}

export function repeatPenaltyFromRecentCounts(input: {
  artistNameOrId: string;
  tags: string[];
  recentArtistCounts: Record<string, number>;
  recentTagCounts: Record<string, number>;
  artistThreshold?: number;
  tagThreshold?: number;
}): number {
  const artistThreshold =
    input.artistThreshold ?? FEEDBACK_LOOP_CONFIG.dominantArtistPenaltyThreshold;
  const tagThreshold =
    input.tagThreshold ?? FEEDBACK_LOOP_CONFIG.dominantTagPenaltyThreshold;

  let penalty = 0;
  const artistKey = normalizeToken(input.artistNameOrId);
  const artistCount = artistKey ? input.recentArtistCounts[artistKey] ?? 0 : 0;
  if (artistCount > artistThreshold) {
    penalty += Math.min(0.6, 0.12 * (artistCount - artistThreshold + 1));
  }

  for (const rawTag of input.tags) {
    const tag = normalizeToken(rawTag);
    if (!tag) continue;
    const count = input.recentTagCounts[tag] ?? 0;
    if (count > tagThreshold) {
      penalty += Math.min(0.22, 0.07 * (count - tagThreshold + 1));
    }
  }

  return Math.min(1, Number(penalty.toFixed(4)));
}
