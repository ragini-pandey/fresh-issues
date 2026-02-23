/**
 * Custom error class for GitHub API errors.
 *
 * Carries the HTTP status code, raw response body, and a structured `details`
 * object so callers can branch on specific failure modes (rate limits, auth, etc.)
 * without string-matching the message.
 */
export class GitHubAPIError extends Error {
  /**
   * @param {string}  message  - Human-readable error message shown in the UI.
   * @param {number}  status   - HTTP status code (0 for network errors).
   * @param {any}     response - Raw parsed response body from GitHub.
   * @param {Object}  details  - Extra structured metadata:
   *   @param {string}  [details.technicalMessage]    - Low-level error detail for logs.
   *   @param {string}  [details.rateLimitRemaining]  - x-ratelimit-remaining header value.
   *   @param {Date}    [details.rateLimitReset]       - Parsed rate-limit reset time.
   *   @param {string}  [details.documentationUrl]    - GitHub docs URL from the response.
   *   @param {boolean} [details.isSecondaryRateLimit] - True for secondary (abuse) limits.
   *   @param {string}  [details.originalError]        - Network-level error message.
   */
  constructor(message, status, response, details = {}) {
    super(message);
    this.name        = 'GitHubAPIError';
    this.status      = status;
    this.response    = response;
    this.details     = details;
    this.isRateLimit =
      status === 403 &&
      (message.includes('rate limit') ||
       message.includes('secondary rate limit') ||
       details.isSecondaryRateLimit === true);
  }
}
