import { describe, expect, it } from 'vitest';

import {
  collapseSuppressionIntents,
  isRuleActive,
  splitSuppressionByType,
} from './suppression';

describe('collapseSuppressionIntents', () => {
  it('deduplicates by target and keeps strongest/latest', () => {
    const rules = collapseSuppressionIntents(
      [
        { targetType: 'TAG', targetValue: 'rock', strength: 0.5, reason: null, weeks: 2 },
        { targetType: 'TAG', targetValue: 'Rock', strength: 0.8, reason: null, weeks: 3 },
      ],
      { now: new Date('2026-03-02T00:00:00Z') }
    );
    expect(rules).toHaveLength(1);
    expect(rules[0].targetValue).toBe('rock');
    expect(rules[0].strength).toBe(0.8);
  });
});

describe('helpers', () => {
  it('splits suppressions by type', () => {
    const split = splitSuppressionByType([
      {
        targetType: 'ARTIST',
        targetValue: 'artist-1',
        strength: 1,
        reason: null,
        expiresAt: new Date('2099-01-01'),
      },
    ]);
    expect(split.artists['artist-1']).toBe(1);
  });

  it('detects active rules', () => {
    expect(isRuleActive({ expiresAt: new Date('2099-01-01') }, new Date('2026-01-01'))).toBe(true);
  });
});
