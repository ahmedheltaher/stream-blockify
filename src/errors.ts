export class BlockifyError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);

		Object.defineProperty(this, 'name', {
			value: 'BlockifyError',
			enumerable: false,
			configurable: true
		});

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}

		Object.setPrototypeOf(this, BlockifyError.prototype);
	}
}
