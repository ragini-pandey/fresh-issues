import { describe, it, expect } from 'vitest';
import { GitHubAPIError } from './github.error.js';

describe('GitHubAPIError', () => {
  it('is an instance of Error with the right name', () => {
    const err = new GitHubAPIError('boom', 500, null);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('GitHubAPIError');
    expect(err.message).toBe('boom');
    expect(err.status).toBe(500);
  });

  it('flags primary rate limits (403 + "rate limit")', () => {
    const err = new GitHubAPIError('API rate limit exceeded', 403, {});
    expect(err.isRateLimit).toBe(true);
  });

  it('flags secondary rate limits via message', () => {
    const err = new GitHubAPIError('secondary rate limit hit', 403, {});
    expect(err.isRateLimit).toBe(true);
  });

  it('flags secondary rate limits via details flag', () => {
    const err = new GitHubAPIError('forbidden', 403, {}, { isSecondaryRateLimit: true });
    expect(err.isRateLimit).toBe(true);
  });

  it('does not flag non-403 errors as rate limits', () => {
    const err = new GitHubAPIError('rate limit', 500, {});
    expect(err.isRateLimit).toBe(false);
  });

  it('does not flag unrelated 403s as rate limits', () => {
    const err = new GitHubAPIError('forbidden', 403, {});
    expect(err.isRateLimit).toBe(false);
  });

  it('preserves response and details payloads', () => {
    const response = { message: 'x' };
    const details = { documentationUrl: 'https://docs', technicalMessage: 't' };
    const err = new GitHubAPIError('msg', 422, response, details);
    expect(err.response).toBe(response);
    expect(err.details).toEqual(details);
  });
});
