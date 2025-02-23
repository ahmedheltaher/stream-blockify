/**
 * Base error class for all StreamBlockify errors
 * Ensures proper prototype chain and error properties
 */
export abstract class StreamBlockifyError extends Error {
	/**
	 * Creates a new StreamBlockify error
	 * @param message - Error message
	 * @param options - Optional error cause and other properties
	 */
	protected constructor(message: string, options: ErrorOptions = {}) {
		super(message, options);

		// Ensure proper prototypal inheritance for ES5 environments
		Object.setPrototypeOf(this, new.target.prototype);

		// Capture stack trace if available
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}

		this.name = this.constructor.name;
	}

	/**
	 * Creates a formatted error message with optional details
	 */
	protected static formatMessage(message: string, details?: string): string {
		return details ? `${message}: ${details}` : message;
	}
}

/**
 * Error thrown when attempting to write to a stream after it has ended
 */
export class WriteAfterEndError extends StreamBlockifyError {
	private static readonly DEFAULT_MESSAGE = 'Cannot write after end has been called';

	constructor(options: ErrorOptions = {}) {
		super(WriteAfterEndError.DEFAULT_MESSAGE, options);
	}
}

/**
 * Error thrown when a buffer operation fails
 */
export class BufferOperationError extends StreamBlockifyError {
	public readonly operation: string;
	public readonly details: string;

	/**
	 * Creates a new BufferOperationError
	 * @param operation - Name of the failed operation
	 * @param details - Additional error details
	 * @param options - Optional error cause and other properties
	 */
	constructor(operation: string, details: string, options: ErrorOptions = {}) {
		const message = BufferOperationError.formatBufferErrorMessage(operation, details);
		super(message, options);

		this.operation = operation;
		this.details = details;
	}

	/**
	 * Formats the buffer operation error message
	 */
	private static formatBufferErrorMessage(operation: string, details: string): string {
		return StreamBlockifyError.formatMessage(`Buffer operation '${operation}' failed`, details);
	}

	/**
	 * Creates a JSON representation of the error
	 */
	public toJSON(): Record<string, unknown> {
		return {
			name: this.name,
			message: this.message,
			operation: this.operation,
			details: this.details,
			stack: this.stack
		};
	}
}

/**
 * Type guard to check if an error is a StreamBlockifyError
 */
export function isStreamBlockifyError(error: unknown): error is StreamBlockifyError {
	return error instanceof StreamBlockifyError;
}

/**
 * Type guard to check if an error is a specific type of StreamBlockifyError
 */
export function isSpecificStreamError<T extends StreamBlockifyError>(
	error: unknown,
	errorType: new (...args: any[]) => T
): error is T {
	return error instanceof errorType;
}
