export class BlockifyError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = this.constructor.name;

		// Only capture stack trace if Error.captureStackTrace is available (Node.js)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}
}
