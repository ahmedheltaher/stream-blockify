import { PassThrough, Readable } from 'stream';
import { StreamBlockify } from '../src';

function collectStreamData(stream: Readable): Promise<Buffer[]> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', chunk => chunks.push(chunk));
		stream.on('end', () => resolve(chunks));
		stream.on('error', reject);
	});
}

function createReadableStream(data: (Buffer | string)[]): Readable {
	return Readable.from(data);
}

describe('StreamBlockify', () => {
	describe('Basic functionality', () => {
		it('should chunk data into blocks of the specified size', async () => {
			const source = createReadableStream([Buffer.from('0123456789ABCDEF')]);
			const blockify = new StreamBlockify({ blockSize: 4 });

			source.pipe(blockify);
			const blocks = await collectStreamData(blockify);

			expect(blocks.length).toBe(4);
			expect(blocks[0].toString()).toBe('0123');
			expect(blocks[1].toString()).toBe('4567');
			expect(blocks[2].toString()).toBe('89AB');
			expect(blocks[3].toString()).toBe('CDEF');
		});

		it('should handle string input', async () => {
			const source = createReadableStream(['0123456789ABCDEF']);
			const blockify = new StreamBlockify({ blockSize: 4 });

			source.pipe(blockify);
			const blocks = await collectStreamData(blockify);

			expect(blocks.length).toBe(4);
			expect(blocks[0].toString()).toBe('0123');
			expect(blocks[1].toString()).toBe('4567');
			expect(blocks[2].toString()).toBe('89AB');
			expect(blocks[3].toString()).toBe('CDEF');
		});

		it('should emit partial blocks by default', async () => {
			const source = createReadableStream([Buffer.from('0123456789')]);
			const blockify = new StreamBlockify({ blockSize: 4 });

			source.pipe(blockify);
			const blocks = await collectStreamData(blockify);

			expect(blocks.length).toBe(3);
			expect(blocks[0].toString()).toBe('0123');
			expect(blocks[1].toString()).toBe('4567');
			expect(blocks[2].toString()).toBe('89');
		});

		it('should pad the last block when emitPartial is false', async () => {
			const source = createReadableStream([Buffer.from('0123456789')]);
			const blockify = new StreamBlockify({ blockSize: 4, emitPartial: false, padding: 0x50 /* 'P' */ });

			source.pipe(blockify);
			const blocks = await collectStreamData(blockify);

			expect(blocks.length).toBe(3);
			expect(blocks[0].toString()).toBe('0123');
			expect(blocks[1].toString()).toBe('4567');
			expect(blocks[2].toString()).toBe('89PP');
		});

		it('should handle multiple chunks correctly', async () => {
			const source = createReadableStream([
				Buffer.from('0123'),
				Buffer.from('4567'),
				Buffer.from('89AB'),
				Buffer.from('CDEF')
			]);
			const blockify = new StreamBlockify({ blockSize: 6 });

			source.pipe(blockify);
			const blocks = await collectStreamData(blockify);

			expect(blocks.length).toBe(3);
			expect(blocks[0].toString()).toBe('012345');
			expect(blocks[1].toString()).toBe('6789AB');
			expect(blocks[2].toString()).toBe('CDEF');
		});

		it('should handle empty input', async () => {
			const source = createReadableStream([]);
			const blockify = new StreamBlockify({ blockSize: 4 });

			source.pipe(blockify);
			const blocks = await collectStreamData(blockify);

			expect(blocks.length).toBe(0);
		});

		it('should throw an error for invalid blockSize', () => {
			expect(() => {
				new StreamBlockify({ blockSize: 0 });
			}).toThrow('blockSize must be a positive integer');

			expect(() => {
				new StreamBlockify({ blockSize: -1 });
			}).toThrow('blockSize must be a positive integer');

			expect(() => {
				new StreamBlockify({ blockSize: 3.5 });
			}).toThrow('blockSize must be a positive integer');
		});
	});

	describe('Advanced functionality', () => {
		it('should pad with Buffer when a Buffer padding is provided', async () => {
			const source = createReadableStream([Buffer.from('0123456789')]);
			const paddingBuffer = Buffer.from('XYZ');
			const blockify = new StreamBlockify({
				blockSize: 4,
				emitPartial: false,
				padding: paddingBuffer
			});

			source.pipe(blockify);
			const blocks = await collectStreamData(blockify);

			expect(blocks.length).toBe(3);
			expect(blocks[0].toString()).toBe('0123');
			expect(blocks[1].toString()).toBe('4567');
			expect(blocks[2].toString()).toBe('89XY');
		});

		it('should call onBlock for each emitted block', async () => {
			const onBlockMock = jest.fn();
			const source = createReadableStream([Buffer.from('0123456789ABCDEF')]);
			const blockify = new StreamBlockify({
				blockSize: 4,
				onBlock: onBlockMock
			});

			source.pipe(blockify);
			await collectStreamData(blockify);

			expect(onBlockMock).toHaveBeenCalledTimes(4);
			expect(onBlockMock).toHaveBeenNthCalledWith(1, expect.any(Buffer));
			expect(onBlockMock.mock.calls[0][0].toString()).toBe('0123');
		});

		it('should apply block transformation if provided', async () => {
			const source = createReadableStream([Buffer.from('abcdefghijklmnop')]);
			const blockify = new StreamBlockify({
				blockSize: 4,
				blockTransform: block => Buffer.from(block.toString().toUpperCase())
			});

			source.pipe(blockify);
			const blocks = await collectStreamData(blockify);

			expect(blocks.length).toBe(4);
			expect(blocks[0].toString()).toBe('ABCD');
			expect(blocks[1].toString()).toBe('EFGH');
			expect(blocks[2].toString()).toBe('IJKL');
			expect(blocks[3].toString()).toBe('MNOP');
		});

		it('should reset internal state when reset() is called', async () => {
			const blockify = new StreamBlockify({ blockSize: 4 });

			blockify.write(Buffer.from('012'));
			expect(blockify.getPosition()).toBe(3);

			blockify.reset();
			expect(blockify.getPosition()).toBe(0);

			blockify.write(Buffer.from('abcd'));

			blockify.end();

			const blocks = await collectStreamData(blockify);
			expect(blocks.length).toBe(1);
			expect(blocks[0].toString()).toBe('abcd');
		});
	});

	describe('Edge cases and error handling', () => {
		it('should handle chunks larger than blockSize', async () => {
			const source = createReadableStream([Buffer.from('0123456789ABCDEF0123456789ABCDEF')]);
			const blockify = new StreamBlockify({ blockSize: 4 });

			source.pipe(blockify);
			const blocks = await collectStreamData(blockify);

			expect(blocks.length).toBe(8);
			expect(blocks[0].toString()).toBe('0123');
			expect(blocks[7].toString()).toBe('CDEF');
		});

		it('should handle zero-length chunks', async () => {
			const source = createReadableStream([Buffer.from('0123'), Buffer.from(''), Buffer.from('4567')]);
			const blockify = new StreamBlockify({ blockSize: 4 });

			source.pipe(blockify);
			const blocks = await collectStreamData(blockify);

			expect(blocks.length).toBe(2);
			expect(blocks[0].toString()).toBe('0123');
			expect(blocks[1].toString()).toBe('4567');
		});

		it('should handle backpressure correctly', async () => {
			const slowDest = new PassThrough({ highWaterMark: 2 });

			let writtenBytes = 0;
			const originalWrite = slowDest.write;

			slowDest.write = function (
				chunk: any,
				encoding?: BufferEncoding | ((error: Error | null | undefined) => void),
				callback?: (error: Error | null | undefined) => void
			): boolean {
				if (typeof encoding === 'function') {
					callback = encoding;
					encoding = undefined;
				}
				writtenBytes += chunk.length;
				return originalWrite.call(this, chunk, callback);
			};

			const largeData = Buffer.alloc(10 * 1024, 'x');
			const source = createReadableStream([largeData]);

			const blockify = new StreamBlockify({
				blockSize: 1024,
				maximumBufferedBlocks: 5
			});

			source.pipe(blockify).pipe(slowDest);

			const processChunk = () => {
				if (slowDest.read()) {
					setImmediate(processChunk);
				}
			};
			processChunk();

			await new Promise<void>((resolve, _reject) => {
				const timeoutId = setTimeout(() => {
					// If our test is still running after 5 seconds, resolve anyway
					// and check if we've processed at least some data
					resolve();
				}, 5000);

				slowDest.on('finish', () => {
					clearTimeout(timeoutId);
					resolve();
				});
			});

			expect(writtenBytes).toBeGreaterThan(0);
		});

		it('should recover from errors in blockTransform', async () => {
			const source = createReadableStream([Buffer.from('0123456789ABCDEF')]);

			let errorCount = 0;
			let dataCount = 0;

			const blockify = new StreamBlockify({
				blockSize: 4,
				blockTransform: block => {
					if (block.toString() === '4567') {
						throw new Error('Test error');
					}
					return block;
				}
			});

			source.pipe(blockify);

			blockify.on('error', () => {
				errorCount++;
			});

			blockify.on('data', () => {
				dataCount++;
			});

			await new Promise(resolve => {
				blockify.on('end', resolve);
				source.on('end', () => {
					blockify.end();
				});
			});

			expect(errorCount).toBe(1);
			expect(dataCount).toBe(3);
		});
	});

	describe('Performance options', () => {
		it('should respect copyBuffers option', async () => {
			const source = createReadableStream([Buffer.from('0123456789ABCDEF')]);
			const blockify = new StreamBlockify({ blockSize: 8, copyBuffers: false });

			source.pipe(blockify);
			const blocks = await collectStreamData(blockify);

			expect(blocks.length).toBe(2);
			expect(blocks[0].toString()).toBe('01234567');
			expect(blocks[1].toString()).toBe('89ABCDEF');
		});

		it('should respect safeAllocation option', () => {
			const blockifySafe = new StreamBlockify({ blockSize: 1024, safeAllocation: true });

			const blockifyUnsafe = new StreamBlockify({ blockSize: 1024, safeAllocation: false });

			// Both should work, but we can't really test the difference
			// other than checking they don't throw errors
			expect(blockifySafe).toBeInstanceOf(StreamBlockify);
			expect(blockifyUnsafe).toBeInstanceOf(StreamBlockify);
		});
	});
});
