import { describe, expect, it } from 'vitest';

import { SpotifyOAuthError } from './oauth';

describe('SpotifyOAuthError', () => {
  it('keeps status and details for structured diagnostics', () => {
    const err = new SpotifyOAuthError('exchange failed', 400, {
      error: 'invalid_grant',
      error_description: 'Invalid authorization code',
    });

    expect(err.name).toBe('SpotifyOAuthError');
    expect(err.message).toBe('exchange failed');
    expect(err.status).toBe(400);
    expect(err.details).toEqual({
      error: 'invalid_grant',
      error_description: 'Invalid authorization code',
    });
  });
});
