import { describe, expect, it } from 'vitest';

import {
  isAlbumInCooldown,
  isArtistOverRepeatCap,
  repeatPenaltyFromRecentCounts,
} from './cooldowns';

describe('cooldowns', () => {
  it('detects album cooldown hit', () => {
    expect(isAlbumInCooldown('album-1', new Set(['album-1']))).toBe(true);
  });

  it('detects artist repeat cap', () => {
    expect(isArtistOverRepeatCap('Artist A', { 'artist a': 3 }, 2)).toBe(true);
  });

  it('computes repeat penalty from dominant artist/tag', () => {
    const penalty = repeatPenaltyFromRecentCounts({
      artistNameOrId: 'Artist A',
      tags: ['rock'],
      recentArtistCounts: { 'artist a': 4 },
      recentTagCounts: { rock: 5 },
    });
    expect(penalty).toBeGreaterThan(0);
  });
});
