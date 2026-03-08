import { describe, expect, it } from 'vitest';

import {
  applyDeltasToProfile,
  combineDeltas,
  rebuildProfileFromResults,
} from './profile-update';
import type { PreferenceDeltaResult } from './types';

const sampleResult: PreferenceDeltaResult = {
  score: 2,
  deltas: {
    artist: { 'artist-1': 2 },
    tag: { rock: 1.2 },
    album: { 'album-1': 2.4 },
  },
  suppressions: [],
};

describe('combineDeltas', () => {
  it('aggregates multiple delta sets', () => {
    const combined = combineDeltas([sampleResult, sampleResult]);
    expect(combined.artist['artist-1']).toBeCloseTo(4);
    expect(combined.tag.rock).toBeCloseTo(2.4);
  });
});

describe('profile update', () => {
  it('applies deltas to an existing profile', () => {
    const profile = applyDeltasToProfile(
      {
        artistWeights: { 'artist-1': 1 },
        tagWeights: {},
        albumWeights: {},
        profileVersion: 1,
        sourceWindowWeeks: 12,
      },
      sampleResult.deltas
    );

    expect(profile.artistWeights['artist-1']).toBeGreaterThan(2.9);
    expect(profile.albumWeights['album-1']).toBeGreaterThan(2);
  });

  it('builds profile from results', () => {
    const profile = rebuildProfileFromResults([sampleResult]);
    expect(profile.artistWeights['artist-1']).toBeGreaterThan(0);
  });
});
