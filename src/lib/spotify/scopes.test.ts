import { describe, expect, it } from 'vitest';

import {
  getMissingScopes,
  serializeScopes,
  SPOTIFY_LOGIN_SCOPES,
  SPOTIFY_PROFILE_SCOPES,
} from './scopes';

describe('spotify scopes', () => {
  it('includes required profile scopes in login scopes', () => {
    for (const requiredScope of SPOTIFY_PROFILE_SCOPES) {
      expect(SPOTIFY_LOGIN_SCOPES).toContain(requiredScope);
    }
  });

  it('serializes scopes and removes duplicates/empty values', () => {
    const serialized = serializeScopes(['user-read-email', '', 'user-read-private', 'user-read-email']);
    expect(serialized).toBe('user-read-email user-read-private');
  });

  it('returns missing scopes from granted scope text', () => {
    const missing = getMissingScopes(
      'user-read-private user-top-read',
      ['user-read-private', 'user-read-email']
    );

    expect(missing).toEqual(['user-read-email']);
  });
});
