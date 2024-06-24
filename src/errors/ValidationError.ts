import BadRequestError from './BadRequestError';

export default class ValidationError extends BadRequestError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';

    // Ensure stack trace is captured for debugging
    Error.captureStackTrace(this, ValidationError);
  }
}
