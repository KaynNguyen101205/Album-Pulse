import type {
  CandidateForRanking,
  ScoredCandidate,
  RankedRecommendation,
  ScoreBreakdown,
  RecommendationReason,
  MatchedPreference,
} from './types';
import {
  SCORING_WEIGHTS,
  RECOMMENDATIONS_COUNT,
  MAX_ALBUMS_PER_ARTIST_IN_FINAL,
  MIN_TAGS_IN_FINAL,
  MMR_LAMBDA,
} from './config';
import { similarityScore } from './similarity';
import { hiddenGemScore } from './hiddenGems';
import { noveltyScore, type NoveltyContext } from './novelty';
import {
  diversityScoreVsUser,
  diversityScoreVsSelected,
  getArtistKey,
  getTagKeys,
  type UserFavoriteContext,
} from './diversity';

export type RankAlbumsContext = {
  recentlyRecommendedAlbumIds: string[];
  userFavoriteArtistNames: string[];
  userFavoriteTags: string[];
};

/**
 * Score all candidates and return scored list (with breakdown).
 */
export function scoreCandidates(
  candidates: CandidateForRanking[],
  context: RankAlbumsContext
): ScoredCandidate[] {
  const noveltyCtx: NoveltyContext = {
    recentlyRecommendedAlbumIds: new Set(context.recentlyRecommendedAlbumIds),
  };
  const userCtx: UserFavoriteContext = {
    artistNames: context.userFavoriteArtistNames,
    tags: context.userFavoriteTags,
  };

  return candidates.map((candidate) => {
    const similarity = similarityScore(candidate);
    const hiddenGem = hiddenGemScore(candidate);
    const novelty = noveltyScore(candidate, noveltyCtx);
    const diversity = diversityScoreVsUser(candidate, userCtx);

    const score =
      SCORING_WEIGHTS.similarity * similarity +
      SCORING_WEIGHTS.hiddenGem * hiddenGem +
      SCORING_WEIGHTS.novelty * novelty +
      SCORING_WEIGHTS.diversity * diversity;

    return {
      candidate,
      score,
      breakdown: { similarity, hiddenGem, novelty, diversity },
    };
  });
}

/**
 * MMR-style selection: pick top N with max 1 per artist and at least 2 tags in final set.
 */
export function selectTopN(
  scored: ScoredCandidate[],
  n: number
): ScoredCandidate[] {
  const selected: ScoredCandidate[] = [];
  const pool = [...scored].sort((a, b) => b.score - a.score);
  const selectedArtists = new Set<string>();
  const selectedTags = new Set<string>();

  while (selected.length < n && pool.length > 0) {
    let bestIdx = -1;
    let bestMmr = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const item = pool[i];
      const artistKey = getArtistKey(item);
      if (selectedArtists.has(artistKey)) continue;

      const relevance = item.score;
      const diversityVs = diversityScoreVsSelected(item, selected);
      const mmr = MMR_LAMBDA * relevance + (1 - MMR_LAMBDA) * diversityVs;

      let bonus = 1;
      const itemTags = getTagKeys(item);
      const addsNewTag = itemTags.some((t) => !selectedTags.has(t));
      if (selectedTags.size < MIN_TAGS_IN_FINAL && addsNewTag) {
        bonus = 1.3;
      }
      const mmrWithBonus = mmr * bonus;
      if (mmrWithBonus > bestMmr) {
        bestMmr = mmrWithBonus;
        bestIdx = i;
      }
    }

    if (bestIdx < 0) break;
    const chosen = pool.splice(bestIdx, 1)[0];
    selected.push(chosen);
    selectedArtists.add(getArtistKey(chosen));
    getTagKeys(chosen).forEach((t) => selectedTags.add(t));
  }

  return selected;
}

function buildReasons(breakdown: ScoreBreakdown): RecommendationReason[] {
  const reasons: RecommendationReason[] = [];
  if (breakdown.similarity >= 0.6) reasons.push('similarity');
  if (breakdown.hiddenGem >= 0.6) reasons.push('hidden_gem');
  if (breakdown.novelty >= 0.6) reasons.push('novelty');
  if (breakdown.diversity >= 0.6) reasons.push('diversity');
  if (reasons.length === 0) reasons.push('similarity');
  return reasons;
}

function buildMatchedPreferences(
  candidate: CandidateForRanking
): MatchedPreference[] {
  const matched: MatchedPreference[] = [];
  if (candidate.sources.includes('vector')) {
    matched.push({
      type: 'favorite_album',
      description: 'Similar to albums you like',
    });
  }
  if (candidate.sources.includes('artist')) {
    matched.push({
      type: 'favorite_artist',
      description: `From artists similar to ones you like`,
    });
  }
  if (candidate.sources.includes('tag')) {
    matched.push({
      type: 'favorite_tag',
      description: 'Matches genres you enjoy',
    });
  }
  if (matched.length === 0) {
    matched.push({
      type: 'favorite_album',
      description: 'Recommended for you',
    });
  }
  return matched;
}

function buildShortExplanation(
  candidate: CandidateForRanking,
  reasons: RecommendationReason[]
): string {
  const parts: string[] = [];
  if (reasons.includes('similarity')) parts.push('similar to your favorites');
  if (reasons.includes('hidden_gem')) parts.push('a lesser-known pick');
  if (reasons.includes('novelty')) parts.push('something fresh for you');
  if (reasons.includes('diversity')) parts.push('adds variety');
  return parts.length > 0 ? parts.join('; ') : 'Recommended for you';
}

/**
 * Turn selected scored candidates into final recommendations with explanations.
 */
export function buildRecommendations(
  selected: ScoredCandidate[]
): RankedRecommendation[] {
  return selected.map((sc, idx) => {
    const reasons = buildReasons(sc.breakdown);
    const matched = buildMatchedPreferences(sc.candidate);
    const short = buildShortExplanation(sc.candidate, reasons);
    return {
      albumId: sc.candidate.albumId,
      mbid: sc.candidate.mbid,
      title: sc.candidate.title,
      artistName: sc.candidate.artistName,
      releaseYear: sc.candidate.releaseYear,
      tags: [...sc.candidate.tags],
      coverUrl: sc.candidate.coverUrl,
      rank: idx + 1,
      score: sc.score,
      breakdown: sc.breakdown,
      explanation: {
        short,
        reasons,
        matchedPreferences: matched,
      },
    };
  });
}

/**
 * Rank candidates and return exactly 5 (or fewer if pool is smaller) with explanations.
 */
export function rankAlbums(
  candidates: CandidateForRanking[],
  context: RankAlbumsContext
): RankedRecommendation[] {
  if (candidates.length === 0) return [];

  const scored = scoreCandidates(candidates, context);
  const topN = selectTopN(scored, Math.min(RECOMMENDATIONS_COUNT, candidates.length));
  return buildRecommendations(topN);
}
