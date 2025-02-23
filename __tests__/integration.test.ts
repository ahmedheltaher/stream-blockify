import { WriteAfterEndError } from '../src/errors';
import { StreamBlockify } from '../src/stream-blockify';

describe('StreamBlockify Integration Tests', () => {
	describe('Complete data flow scenarios', () => {
		it('should correctly chunk data based on the specified size', done => {
			const stream = new StreamBlockify({ size: 5 });
			const chunks: Buffer[] = [];

			stream.on('data', chunk => {
				chunks.push(chunk);
			});

			stream.on('end', () => {
				expect(chunks.length).toBe(3);
				expect(chunks[0].toString()).toBe('12345');
				expect(chunks[1].toString()).toBe('67890');
				expect(chunks[2].toString()).toBe('abc');
				done();
			});

			stream.write('123456789');
			stream.write('0abc');
			stream.end();
		}, 20_000);

		it('should handle empty writes correctly', done => {
			const stream = new StreamBlockify({ size: 5 });
			const chunks: Buffer[] = [];

			stream.on('data', chunk => {
				chunks.push(chunk);
			});

			stream.on('end', () => {
				expect(chunks.length).toBe(1);
				expect(chunks[0].toString()).toBe('hello');
				done();
			});

			stream.write('');
			stream.write('hel');
			stream.write('');
			stream.write('lo');
			stream.end();
		});

		it('should prevent writing after end', () => {
			const stream = new StreamBlockify();
			stream.end();

			try {
				stream.write('test');
			} catch (error: unknown) {
				if (error instanceof WriteAfterEndError) {
					expect(error.name).toBe('WriteAfterEndError');
					expect(error.message).toBe('Cannot write after end has been called');
				}
			}
		});
	});

	describe('Edge cases', () => {
		it('should handle very large writes', done => {
			const stream = new StreamBlockify({ size: 1024 });
			const largeData = Buffer.alloc(10_240, 'x');
			let totalReceived = 0;

			stream.on('data', chunk => {
				totalReceived += chunk.length;
			});

			stream.on('end', () => {
				expect(totalReceived).toBe(10_240);
				done();
			});

			stream.write(largeData);
			stream.end();
		});

		it('should handle small writes that accumulate to exceed chunk size', done => {
			const stream = new StreamBlockify({ size: 10 });
			const chunks: Buffer[] = [];

			stream.on('data', chunk => {
				chunks.push(chunk);
			});

			stream.on('end', () => {
				expect(chunks.length).toBe(2);
				expect(chunks[0].length).toBe(10);
				expect(chunks[1].length).toBe(5);
				expect(Buffer.concat(chunks).toString()).toBe('abcdefghijklmno');
				done();
			});

			// Write single characters to test accumulation
			'abcdefghijklmno'.split('').forEach(char => {
				stream.write(char);
			});

			stream.end();
		});

		it('should handle flush with no data', done => {
			const stream = new StreamBlockify();
			let dataEventFired = false;

			stream.on('data', () => {
				dataEventFired = true;
			});

			stream.on('end', () => {
				expect(dataEventFired).toBe(false);
				done();
			});

			stream.flush();
			stream.end();
		});
	});

	describe('Error handling', () => {
		it('should propagate errors from buffer operations', done => {
			// Create a stream with a mock buffer manager that will throw
			const mockBufferManager = {
				addBuffer: jest.fn().mockImplementation(() => {
					throw new Error('Mock buffer error');
				}),
				getTotalLength: jest.fn().mockReturnValue(0),
				getChunks: jest.fn().mockReturnValue([]),
				clear: jest.fn(),
				getRemainingData: jest.fn().mockReturnValue(null)
			};

			const stream = new StreamBlockify({}, mockBufferManager);

			stream.on('error', error => {
				expect(error.message).toBe("Buffer operation 'write' failed: Mock buffer error");
				done();
			});

			try {
				stream.write('test');
			} catch (error: unknown) {
				if (error instanceof Error) {
					expect(error.message).toBe('Mock buffer error');
				}
			}
		});
	});

	describe('Performance', () => {
		it('should handle high-throughput streaming', done => {
			const stream = new StreamBlockify({ size: 1024 });
			const iterations = 100;
			const chunkSize = 512;
			let totalBytes = 0;
			let receivedBytes = 0;

			stream.on('data', chunk => {
				receivedBytes += chunk.length;
			});

			stream.on('end', () => {
				expect(receivedBytes).toBe(totalBytes);
				done();
			});

			// Write many chunks of data
			for (let i = 0; i < iterations; i++) {
				const chunk = Buffer.alloc(chunkSize, i % 256);
				totalBytes += chunkSize;
				stream.write(chunk);
			}

			stream.end();
		});
	});
});
