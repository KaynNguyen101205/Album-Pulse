import { FEEDBACK_LOOP_CONFIG, RECOMMENDATION_PROFILE_VERSION } from './config';
import type {
  PreferenceDeltaResult,
  ProfileDeltas,
  UserPreferenceProfileState,
  WeightedMap,
} from './types';

function add(map: WeightedMap, key: string, value: number): void {
  if (!key || !Number.isFinite(value) || value === 0) return;
  map[key] = (map[key] ?? 0) + value;
}

function mergeWeightedMap(base: WeightedMap, incoming: WeightedMap): WeightedMap {
  const next: WeightedMap = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    add(next, key, value);
  }
  return next;
}

function pruneAndNormalize(
  map: WeightedMap,
  maxEntries: number,
  opts?: { minAbs?: number }
): WeightedMap {
  const minAbs = opts?.minAbs ?? 0.12;
  const entries = Object.entries(map)
    .filter(([, value]) => Number.isFinite(value) && Math.abs(value) >= minAbs)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, maxEntries);

  const result: WeightedMap = {};
  for (const [key, value] of entries) {
    result[key] = Number(value.toFixed(4));
  }
  return result;
}

export function combineDeltas(results: PreferenceDeltaResult[]): ProfileDeltas {
  const combined: ProfileDeltas = {
    artist: {},
    tag: {},
    album: {},
  };

  for (const result of results) {
    for (const [key, value] of Object.entries(result.deltas.artist)) {
      add(combined.artist, key, value);
    }
    for (const [key, value] of Object.entries(result.deltas.tag)) {
      add(combined.tag, key, value);
    }
    for (const [key, value] of Object.entries(result.deltas.album)) {
      add(combined.album, key, value);
    }
  }

  return combined;
}

export function applyDeltasToProfile(
  currentProfile: UserPreferenceProfileState | null,
  deltas: ProfileDeltas
): UserPreferenceProfileState {
  const base: UserPreferenceProfileState =
    currentProfile ??
    {
      artistWeights: {},
      tagWeights: {},
      albumWeights: {},
      profileVersion: RECOMMENDATION_PROFILE_VERSION,
      sourceWindowWeeks: FEEDBACK_LOOP_CONFIG.sourceWindowWeeks,
    };

  const merged: UserPreferenceProfileState = {
    profileVersion: RECOMMENDATION_PROFILE_VERSION,
    sourceWindowWeeks: FEEDBACK_LOOP_CONFIG.sourceWindowWeeks,
    artistWeights: mergeWeightedMap(base.artistWeights, deltas.artist),
    tagWeights: mergeWeightedMap(base.tagWeights, deltas.tag),
    albumWeights: mergeWeightedMap(base.albumWeights, deltas.album),
  };

  return {
    ...merged,
    artistWeights: pruneAndNormalize(
      merged.artistWeights,
      FEEDBACK_LOOP_CONFIG.maxStoredArtistWeights
    ),
    tagWeights: pruneAndNormalize(
      merged.tagWeights,
      FEEDBACK_LOOP_CONFIG.maxStoredTagWeights
    ),
    albumWeights: pruneAndNormalize(
      merged.albumWeights,
      FEEDBACK_LOOP_CONFIG.maxStoredAlbumWeights
    ),
  };
}

export function rebuildProfileFromResults(
  results: PreferenceDeltaResult[]
): UserPreferenceProfileState {
  const deltas = combineDeltas(results);
  return applyDeltasToProfile(null, deltas);
}
