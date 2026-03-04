export type SpotifyErrorCode =
  | 'unauthorized'
  | 'rate_limited'
  | 'internal_error'
  | 'bad_request';

type SpotifyApiErrorInit = {
  code: SpotifyErrorCode;
  status: number;
  message?: string;
  retryAfterSeconds?: number;
  details?: unknown;
};

export class SpotifyApiError extends Error {
  code: SpotifyErrorCode;
  status: number;
  retryAfterSeconds?: number;
  details?: unknown;

  constructor(init: SpotifyApiErrorInit) {
    const message =
      init.message ?? `Spotify API error (status ${init.status}, code ${init.code})`;

    super(message);

    this.name = 'SpotifyApiError';
    this.code = init.code;
    this.status = init.status;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.details = init.details;
  }
}

