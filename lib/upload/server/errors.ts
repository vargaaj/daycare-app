/**
 * Represents an expected upload failure that should be returned to the user as
 * a structured HTTP error instead of bubbling up as an unhandled exception.
 */
export class UploadRouteError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'UploadRouteError';
  }
}

/**
 * Narrows unknown errors so the route can preserve explicit status/message
 * pairs from the upload pipeline.
 */
export const isUploadRouteError = (error: unknown): error is UploadRouteError =>
  error instanceof UploadRouteError;
