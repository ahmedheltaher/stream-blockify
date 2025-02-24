/**
 * Base error class for all StreamBlockify errors.
 * Ensures proper prototype chain and error properties.
 */
export abstract class StreamBlockifyError extends Error {
	/**
	 * Creates a new StreamBlockify error.
	 * @param message - The error message.
	 * @param options - Optional error cause and other properties.
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
	 * Creates a formatted error message with optional details.
	 * @param message - The main error message.
	 * @param details - Additional details to include in the error message.
	 * @returns The formatted error message.
	 */
	protected static formatMessage(message: string, details?: string): string {
		return details ? `${message}: ${details}` : message;
	}
}

/**
 * Error thrown when attempting to write to a stream after it has ended.
 */
export class WriteAfterEndError extends StreamBlockifyError {
	private static readonly DEFAULT_MESSAGE = 'Cannot write after end has been called';

	/**
	 * Creates a new WriteAfterEndError.
	 * @param options - Optional error cause and other properties.
	 */
	constructor(options: ErrorOptions = {}) {
		super(WriteAfterEndError.DEFAULT_MESSAGE, options);
	}
}

/**
 * Error thrown when input validation fails.
 */
export class ValidationError extends StreamBlockifyError {
	public readonly field: string;
	public readonly details: string;

	/**
	 * Creates a new ValidationError.
	 * @param field - The field that failed validation.
	 * @param details - Information about the validation failure.
	 * @param options - Optional error cause and other properties.
	 */
	constructor(field: string, details: string, options: ErrorOptions = {}) {
		const message = ValidationError.formatValidationErrorMessage(field, details);
		super(message, options);

		this.field = field;
		this.details = details;
	}

	/**
	 * Formats the validation error message.
	 * @param field - The field that failed validation.
	 * @param details - Information about the validation failure.
	 * @returns The formatted validation error message.
	 */
	private static formatValidationErrorMessage(field: string, details: string): string {
		return StreamBlockifyError.formatMessage(`Validation failed for '${field}'`, details);
	}
}

/**
 * Error thrown when a buffer operation fails.
 */
export class BufferOperationError extends StreamBlockifyError {
	public readonly operation: string;
	public readonly details: string;

	/**
	 * Creates a new BufferOperationError.
	 * @param operation - Name of the failed operation.
	 * @param details - Additional error details.
	 * @param options - Optional error cause and other properties.
	 */
	constructor(operation: string, details: string, options: ErrorOptions = {}) {
		const message = BufferOperationError.formatBufferErrorMessage(operation, details);
		super(message, options);

		this.operation = operation;
		this.details = details;
	}

	/**
	 * Formats the buffer operation error message.
	 * @param operation - Name of the failed operation.
	 * @param details - Additional error details.
	 * @returns The formatted buffer operation error message.
	 */
	private static formatBufferErrorMessage(operation: string, details: string): string {
		return StreamBlockifyError.formatMessage(`Buffer operation '${operation}' failed`, details);
	}

	/**
	 * Creates a JSON representation of the error.
	 * @returns A JSON object representing the error.
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
 * Error thrown when the stream exceeds its buffer capacity.
 */
export class BufferOverflowError extends StreamBlockifyError {
	public readonly currentSize: number;
	public readonly maxSize: number;

	/**
	 * Creates a new BufferOverflowError.
	 * @param currentSize - Current buffer size.
	 * @param maxSize - Maximum allowed buffer size.
	 * @param options - Optional error cause and other properties.
	 */
	constructor(currentSize: number, maxSize: number, options: ErrorOptions = {}) {
		const message = `Buffer overflow: Size ${currentSize} exceeds maximum ${maxSize} bytes`;
		super(message, options);

		this.currentSize = currentSize;
		this.maxSize = maxSize;
	}
}

/**
 * Type guard to check if an error is a StreamBlockifyError.
 * @param error - The error to check.
 * @returns True if the error is a StreamBlockifyError, false otherwise.
 */
export function isStreamBlockifyError(error: unknown): error is StreamBlockifyError {
	return error instanceof StreamBlockifyError;
}

/**
 * Type guard to check if an error is a specific type of StreamBlockifyError.
 * @param error - The error to check.
 * @param errorType - The specific StreamBlockifyError type to check against.
 * @returns True if the error is of the specified type, false otherwise.
 */
export function isSpecificStreamError<T extends StreamBlockifyError>(
	error: unknown,
	errorType: new (...args: any[]) => T
): error is T {
	return error instanceof errorType;
}
