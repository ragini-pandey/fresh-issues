export interface GitHubAPIErrorDetails {
  technicalMessage?: string;
  rateLimitRemaining?: string | null;
  rateLimitReset?: Date | null;
  documentationUrl?: string;
  isSecondaryRateLimit?: boolean;
  originalError?: string;
}

/**
 * Custom error class for GitHub API errors.
 *
 * Carries the HTTP status code, raw response body, and a structured `details`
 * object so callers can branch on specific failure modes (rate limits, auth, etc.)
 * without string-matching the message.
 */
export class GitHubAPIError extends Error {
  override readonly name = 'GitHubAPIError';
  readonly status: number;
  readonly response: unknown;
  readonly details: GitHubAPIErrorDetails;
  readonly isRateLimit: boolean;

  constructor(
    message: string,
    status: number,
    response: unknown,
    details: GitHubAPIErrorDetails = {},
  ) {
    super(message);
    this.status = status;
    this.response = response;
    this.details = details;
    this.isRateLimit =
      status === 403 &&
      (message.includes('rate limit') ||
        message.includes('secondary rate limit') ||
        details.isSecondaryRateLimit === true);
  }
}
