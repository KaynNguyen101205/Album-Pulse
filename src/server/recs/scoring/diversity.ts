import type { ScoredCandidate, CandidateForRanking } from './types';

export type UserFavoriteContext = {
  artistNames: string[];
  tags: string[];
};

/**
 * Initial diversity score vs user favorites: slight boost for candidates that add
 * a new artist or tag (exploration). 0.5 = neutral, >0.5 = adds variety.
 */
export function diversityScoreVsUser(
  candidate: CandidateForRanking,
  context: UserFavoriteContext
): number {
  const artist = candidate.artistName.trim().toLowerCase();
  const userArtists = new Set(
    context.artistNames.map((a) => a.trim().toLowerCase())
  );
  const userTags = new Set(context.tags.map((t) => t.trim().toLowerCase()));
  const candidateTags = new Set(
    candidate.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)
  );
  const newArtist = !userArtists.has(artist);
  let newTag = false;
  for (const t of candidateTags) {
    if (!userTags.has(t)) {
      newTag = true;
      break;
    }
  }
  if (newArtist && newTag) return 0.9;
  if (newArtist || newTag) return 0.7;
  return 0.5;
}

/**
 * Diversity score for MMR: how different is this candidate from already-selected albums?
 * Based on artist and tags. Higher = more different.
 */
export function diversityScoreVsSelected(
  candidate: ScoredCandidate,
  selected: ScoredCandidate[]
): number {
  if (selected.length === 0) return 1;

  const artist = candidate.candidate.artistName.trim().toLowerCase();
  const tags = new Set(
    candidate.candidate.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)
  );

  let maxOverlap = 0;
  for (const s of selected) {
    const otherArtist = s.candidate.artistName.trim().toLowerCase();
    const otherTags = new Set(
      s.candidate.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)
    );
    const artistMatch = artist === otherArtist ? 1 : 0;
    let tagOverlap = 0;
    if (otherTags.size > 0) {
      for (const t of tags) {
        if (otherTags.has(t)) tagOverlap += 1;
      }
      tagOverlap /= Math.max(tags.size, otherTags.size, 1);
    }
    const overlap = (artistMatch + tagOverlap) / 2;
    maxOverlap = Math.max(maxOverlap, overlap);
  }
  return 1 - maxOverlap;
}

export function getArtistKey(candidate: ScoredCandidate): string {
  return candidate.candidate.artistName.trim().toLowerCase();
}

export function getTagKeys(candidate: ScoredCandidate): string[] {
  return candidate.candidate.tags
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}
