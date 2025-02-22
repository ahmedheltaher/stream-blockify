import { BufferOperationError, StreamBlockifyError, WriteAfterEndError } from '../src/errors';

describe('Custom Errors', () => {
	describe('StreamBlockifyError', () => {
		it('should be an instance of Error', () => {
			const error = new StreamBlockifyError('test message');
			expect(error).toBeInstanceOf(Error);
		});

		it('should have the correct name and message', () => {
			const error = new StreamBlockifyError('test message');
			expect(error.name).toBe('StreamBlockifyError');
			expect(error.message).toBe('test message');
		});
	});

	describe('WriteAfterEndError', () => {
		it('should be an instance of StreamBlockifyError', () => {
			const error = new WriteAfterEndError();
			expect(error).toBeInstanceOf(StreamBlockifyError);
		});

		it('should have the correct name and message', () => {
			const error = new WriteAfterEndError();
			expect(error.name).toBe('WriteAfterEndError');
			expect(error.message).toBe('Cannot write after end has been called');
		});
	});

	describe('BufferOperationError', () => {
		it('should be an instance of StreamBlockifyError', () => {
			const error = new BufferOperationError('read', 'Invalid offset');
			expect(error).toBeInstanceOf(StreamBlockifyError);
		});

		it('should have the correct name and formatted message', () => {
			const error = new BufferOperationError('read', 'Invalid offset');
			expect(error.name).toBe('BufferOperationError');
			expect(error.message).toBe("Buffer operation 'read' failed: Invalid offset");
		});
	});

	describe('Error inheritance', () => {
		it('should maintain proper instanceof behavior', () => {
			const writeError = new WriteAfterEndError();
			const bufferError = new BufferOperationError('write', 'Buffer overflow');

			expect(writeError instanceof Error).toBe(true);
			expect(writeError instanceof StreamBlockifyError).toBe(true);
			expect(writeError instanceof WriteAfterEndError).toBe(true);

			expect(bufferError instanceof Error).toBe(true);
			expect(bufferError instanceof StreamBlockifyError).toBe(true);
			expect(bufferError instanceof BufferOperationError).toBe(true);
		});
	});
});
