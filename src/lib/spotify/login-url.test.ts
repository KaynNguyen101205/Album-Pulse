import { describe, expect, it } from 'vitest';

import { shouldForceSpotifyShowDialog } from './login-url';

describe('spotify login url flags', () => {
  it('returns false for empty values', () => {
    expect(shouldForceSpotifyShowDialog(undefined)).toBe(false);
    expect(shouldForceSpotifyShowDialog('')).toBe(false);
    expect(shouldForceSpotifyShowDialog('   ')).toBe(false);
  });

  it('returns true for accepted truthy values', () => {
    expect(shouldForceSpotifyShowDialog('1')).toBe(true);
    expect(shouldForceSpotifyShowDialog('true')).toBe(true);
    expect(shouldForceSpotifyShowDialog('TRUE')).toBe(true);
    expect(shouldForceSpotifyShowDialog('yes')).toBe(true);
    expect(shouldForceSpotifyShowDialog('on')).toBe(true);
  });

  it('returns false for non-truthy values', () => {
    expect(shouldForceSpotifyShowDialog('0')).toBe(false);
    expect(shouldForceSpotifyShowDialog('false')).toBe(false);
    expect(shouldForceSpotifyShowDialog('no')).toBe(false);
    expect(shouldForceSpotifyShowDialog('off')).toBe(false);
    expect(shouldForceSpotifyShowDialog('random')).toBe(false);
  });
});
