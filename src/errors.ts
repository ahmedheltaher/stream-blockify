export class StreamBlockifyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'StreamBlockifyError';
		Object.setPrototypeOf(this, new.target.prototype);
	}
}

export class WriteAfterEndError extends StreamBlockifyError {
	constructor() {
		super('Cannot write after end has been called');
		this.name = 'WriteAfterEndError';
	}
}

export class BufferOperationError extends StreamBlockifyError {
	constructor(operation: string, details: string) {
		super(`Buffer operation '${operation}' failed: ${details}`);
		this.name = 'BufferOperationError';
	}
}
