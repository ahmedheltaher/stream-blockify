export class BlockifyError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = this.constructor.name;

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}

		Object.setPrototypeOf(this, BlockifyError.prototype);
	}
}
