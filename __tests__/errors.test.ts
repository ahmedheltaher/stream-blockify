import { BlockifyError } from '../src/errors';

describe('BlockifyError', () => {
	it('should create an instance of BlockifyError with the correct message', () => {
		const message = 'Test error message';
		const error = new BlockifyError(message);

		expect(error).toBeInstanceOf(BlockifyError);
		expect(error).toBeInstanceOf(Error);
		expect(error.message).toBe(message);
		expect(error.name).toBe('BlockifyError');
	});

	it('should capture the stack trace if Error.captureStackTrace is available', () => {
		const message = 'Stack trace test';
		const error = new BlockifyError(message);

		expect(error.stack).toBeDefined();
		expect(error.stack).toContain('BlockifyError');
	});

	it('should handle when Error.captureStackTrace is not available', () => {
		const originalCaptureStackTrace = Error.captureStackTrace;

		(Error as any).captureStackTrace = undefined;

		try {
			const message = 'No stack trace capture';
			const error = new BlockifyError(message);

			expect(error).toBeInstanceOf(BlockifyError);
			expect(error.message).toBe(message);
			expect(error.name).toBe('BlockifyError');
			expect(error.stack).toBeDefined();
		} finally {
			(Error as any).captureStackTrace = originalCaptureStackTrace;
		}
	});

	it('should set the prototype correctly', () => {
		const message = 'Prototype test';
		const error = new BlockifyError(message);

		expect(Object.getPrototypeOf(error)).toBe(BlockifyError.prototype);

		expect(error instanceof BlockifyError).toBe(true);
		expect(error instanceof Error).toBe(true);
	});

	it('should handle optional ErrorOptions parameter', () => {
		const message = 'Error with options';
		const cause = new Error('Cause of the error');
		const error = new BlockifyError(message, { cause });

		expect(error.message).toBe(message);
		expect((error as any).cause).toBe(cause);
	});

	it('should be catchable as both BlockifyError and Error', () => {
		try {
			throw new BlockifyError('Test throw');
			fail('Error was not thrown');
		} catch (e) {
			expect(e).toBeInstanceOf(BlockifyError);
			expect(e).toBeInstanceOf(Error);
		}

		let caughtError: unknown;
		try {
			throw new BlockifyError('Another test');
		} catch (e) {
			caughtError = e;
		}

		expect(caughtError instanceof BlockifyError).toBe(true);
		expect(caughtError instanceof Error).toBe(true);
	});
});
