import { describe, it, expect } from 'vitest';
import {
  badRequest,
  validationError,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  internalError,
  apiError,
} from './errors';

describe('api/errors', () => {
  it('validation_error returns 400 with code and message', async () => {
    const res = validationError('Invalid input.', { field: 'q' });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('validation_error');
    expect(json.error.message).toBe('Invalid input.');
    expect(json.error.details).toEqual({ field: 'q' });
  });

  it('unauthorized returns 401', async () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('unauthorized');
  });

  it('forbidden returns 403', async () => {
    const res = forbidden();
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('forbidden');
  });

  it('notFound returns 404', async () => {
    const res = notFound('Resource missing.');
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toBe('Resource missing.');
  });

  it('conflict returns 409', async () => {
    const res = conflict('Duplicate.');
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('conflict');
  });

  it('internalError returns 500', async () => {
    const res = internalError();
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('internal_error');
  });

  it('badRequest returns 400', async () => {
    const res = badRequest('Bad request.');
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('bad_request');
  });

  it('apiError allows custom status and code', async () => {
    const res = apiError(418, 'bad_request', 'Teapot');
    expect(res.status).toBe(418);
    expect((await res.json()).error.message).toBe('Teapot');
  });
});
