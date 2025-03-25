import { Readable, Writable } from 'node:stream';
import { BlockifyError } from '../src/errors';
import { StreamBlockify } from '../src/stream-blockify';

jest.mock('../src/debug', () => ({
	getLogger: jest.fn().mockReturnValue({
		info: jest.fn(),
		debug: jest.fn(),
		trace: jest.fn(),
		error: jest.fn()
	})
}));

const collectChunks = (stream: Readable): Promise<Buffer[]> => {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];

		stream.on('data', chunk => {
			chunks.push(chunk);
		});

		stream.on('end', () => {
			resolve(chunks);
		});

		stream.on('error', err => {
			reject(err);
		});
	});
};

describe('StreamBlockify', () => {
	describe('Constructor', () => {
		it('should create an instance with default options', () => {
			const blockify = new StreamBlockify({ blockSize: 10 });
			expect(blockify).toBeInstanceOf(StreamBlockify);
			expect(blockify.getPosition()).toBe(0);
		});

		it('should throw an error if blockSize is not a positive integer', () => {
			expect(() => new StreamBlockify({ blockSize: 0 })).toThrow(BlockifyError);
			expect(() => new StreamBlockify({ blockSize: -1 })).toThrow(BlockifyError);
			expect(() => new StreamBlockify({ blockSize: 1.5 })).toThrow(BlockifyError);
		});

		it('should use safe buffer allocation when specified', () => {
			const allocSpy = jest.spyOn(Buffer, 'alloc');

			new StreamBlockify({ blockSize: 10, safeAllocation: true });

			expect(allocSpy).toHaveBeenCalledWith(10);

			allocSpy.mockRestore();
		});

		it('should use unsafe buffer allocation by default', () => {
			const allocUnsafeSpy = jest.spyOn(Buffer, 'allocUnsafe');

			new StreamBlockify({ blockSize: 10 });

			expect(allocUnsafeSpy).toHaveBeenCalledWith(10);

			allocUnsafeSpy.mockRestore();
		});
	});

	describe('Public methods', () => {
		it('should reset position', () => {
			const blockify = new StreamBlockify({ blockSize: 10 });

			(blockify as any)._position = 5;
			expect(blockify.getPosition()).toBe(5);

			blockify.reset();
			expect(blockify.getPosition()).toBe(0);
		});

		it('should get current position', () => {
			const blockify = new StreamBlockify({ blockSize: 10 });
			expect(blockify.getPosition()).toBe(0);

			(blockify as any)._position = 7;
			expect(blockify.getPosition()).toBe(7);
		});
	});

	describe('Streaming functionality', () => {
		let onBlockSpy: jest.Mock;
		let blockTransformSpy: jest.Mock;

		beforeEach(() => {
			onBlockSpy = jest.fn();
			blockTransformSpy = jest.fn(block => Buffer.from(block));
		});

		it('should process exact block size chunks', async () => {
			const blockSize = 10;
			const blockify = new StreamBlockify({ blockSize, onBlock: onBlockSpy, blockTransform: blockTransformSpy });

			const sourceData = Buffer.from('A'.repeat(blockSize * 3));
			const source = Readable.from([sourceData]);

			const chunks = await collectChunks(source.pipe(blockify));

			expect(chunks.length).toBe(3);
			chunks.forEach(chunk => {
				expect(chunk.length).toBe(blockSize);
			});
			expect(onBlockSpy).toHaveBeenCalledTimes(3);
			expect(blockTransformSpy).toHaveBeenCalledTimes(3);
		});

		it('should process multiple small chunks into blocks', async () => {
			const blockSize = 10;
			const blockify = new StreamBlockify({ blockSize, onBlock: onBlockSpy });

			const source = Readable.from([
				Buffer.from('AAAA'),
				Buffer.from('BBBB'),
				Buffer.from('CCCC'),
				Buffer.from('DDDD'),
				Buffer.from('EEEE')
			]);

			const chunks = await collectChunks(source.pipe(blockify));

			expect(chunks.length).toBe(2);
			expect(chunks[0].length).toBe(blockSize);
			expect(chunks[1].length).toBe(blockSize);
			expect(onBlockSpy).toHaveBeenCalledTimes(2);
		});

		it('should process string chunks', async () => {
			const blockSize = 10;
			const blockify = new StreamBlockify({ blockSize });

			const source = Readable.from(['ABCDEFGHIJ', 'KLMNOPQRST']);

			const chunks = await collectChunks(source.pipe(blockify));

			expect(chunks.length).toBe(2);
			expect(chunks[0].toString()).toBe('ABCDEFGHIJ');
			expect(chunks[1].toString()).toBe('KLMNOPQRST');
		});

		it('should emit partial blocks when emitPartial is true', async () => {
			const blockSize = 10;
			const blockify = new StreamBlockify({ blockSize, emitPartial: true });

			const source = Readable.from([Buffer.from('A'.repeat(25))]);

			const chunks = await collectChunks(source.pipe(blockify));

			expect(chunks.length).toBe(3);
			expect(chunks[0].length).toBe(blockSize);
			expect(chunks[1].length).toBe(blockSize);
			expect(chunks[2].length).toBe(5);
		});

		it('should pad blocks with numeric padding when emitPartial is false', async () => {
			const blockSize = 10;
			const paddingValue = 0xff;
			const blockify = new StreamBlockify({ blockSize, emitPartial: false, padding: paddingValue });

			const source = Readable.from([Buffer.from('A'.repeat(25))]);

			const chunks = await collectChunks(source.pipe(blockify));

			expect(chunks.length).toBe(3);
			expect(chunks[0].length).toBe(blockSize);
			expect(chunks[1].length).toBe(blockSize);
			expect(chunks[2].length).toBe(blockSize);

			const lastChunk = chunks[2];
			expect(lastChunk.subarray(0, 5).toString()).toBe('A'.repeat(5));

			for (let i = 5; i < blockSize; i++) {
				expect(lastChunk[i]).toBe(paddingValue);
			}
		});

		it('should pad blocks with buffer padding when emitPartial is false', async () => {
			const blockSize = 10;
			const paddingPattern = Buffer.from([1, 2, 3]);
			const blockify = new StreamBlockify({ blockSize, emitPartial: false, padding: paddingPattern });

			const source = Readable.from([Buffer.from('A'.repeat(15))]);

			const chunks = await collectChunks(source.pipe(blockify));

			expect(chunks.length).toBe(2);
			const lastChunk = chunks[1];
			expect(lastChunk.length).toBe(blockSize);

			expect(lastChunk.subarray(0, 5).toString()).toBe('A'.repeat(5));

			expect(lastChunk[5]).toBe(1);
			expect(lastChunk[6]).toBe(2);
			expect(lastChunk[7]).toBe(3);
			expect(lastChunk[8]).toBe(1);
			expect(lastChunk[9]).toBe(2);
		});

		it('should apply custom block transformation', async () => {
			const blockSize = 10;
			const transform = (block: Buffer) => {
				const result = Buffer.alloc(block.length);
				for (let i = 0; i < block.length; i++) {
					result[i] = block[i] + 1;
				}
				return result;
			};

			const blockify = new StreamBlockify({ blockSize, blockTransform: transform });

			const source = Readable.from([Buffer.from('ABCDEFGHIJ')]);

			const chunks = await collectChunks(source.pipe(blockify));

			expect(chunks.length).toBe(1);
			// 'A' (65) + 1 = 'B' (66), etc.
			expect(chunks[0].toString()).toBe('BCDEFGHIJK');
		});

		it('should handle errors in transform', async () => {
			const blockSize = 10;
			const blockify = new StreamBlockify({ blockSize });

			jest.spyOn(blockify as any, '_processChunk').mockImplementation(() => {
				throw new Error('Test error');
			});

			const source = Readable.from([Buffer.from('ABCDEFGHIJ')]);

			await expect(collectChunks(source.pipe(blockify))).rejects.toThrow('Test error');
		});

		it('should handle errors in blockTransform', async () => {
			const blockSize = 10;
			const errorTransform = () => {
				throw new Error('Transform error');
			};

			const blockify = new StreamBlockify({ blockSize, blockTransform: errorTransform });

			const source = Readable.from([Buffer.from('ABCDEFGHIJ')]);

			await expect(collectChunks(source.pipe(blockify))).rejects.toThrow('Transform error');
		});

		it('should handle errors in flush', async () => {
			const blockSize = 10;
			const blockify = new StreamBlockify({ blockSize });

			jest.spyOn(blockify as any, '_emitPartialBlock').mockImplementation(() => {
				throw new Error('Flush error');
			});

			const source = Readable.from([Buffer.from('ABCDE')]);

			await expect(collectChunks(source.pipe(blockify))).rejects.toThrow('Flush error');
		});

		it('should emit nothing when no data is written', async () => {
			const blockify = new StreamBlockify({ blockSize: 10 });
			const source = Readable.from([]);

			const chunks = await collectChunks(source.pipe(blockify));
			expect(chunks.length).toBe(0);
		});

		it('should handle large data streams efficiently', async () => {
			const blockSize = 1024;
			const dataSize = blockSize * 10 + 512;
			const blockify = new StreamBlockify({ blockSize });

			const largeBuffer = Buffer.alloc(dataSize);
			for (let i = 0; i < dataSize; i++) {
				largeBuffer[i] = i % 256;
			}

			const source = Readable.from([largeBuffer]);

			const chunks = await collectChunks(source.pipe(blockify));

			expect(chunks.length).toBe(11);
			chunks.slice(0, 10).forEach(chunk => {
				expect(chunk.length).toBe(blockSize);
			});
			expect(chunks[10].length).toBe(512);
		});

		it('should support piping to multiple destinations', async () => {
			const blockSize = 10;
			const blockify = new StreamBlockify({ blockSize });

			const sourceData = Buffer.from('A'.repeat(blockSize * 2));
			const source = Readable.from([sourceData]);

			const dest1Chunks: Buffer[] = [];
			const dest1 = new Writable({
				write(chunk, _encoding, callback) {
					dest1Chunks.push(chunk);
					callback();
				}
			});

			const dest2Chunks: Buffer[] = [];
			const dest2 = new Writable({
				write(chunk, _encoding, callback) {
					dest2Chunks.push(chunk);
					callback();
				}
			});

			return new Promise<void>((resolve, reject) => {
				source.pipe(blockify);
				blockify.pipe(dest1);
				blockify.pipe(dest2);

				dest2.on('finish', () => {
					try {
						expect(dest1Chunks.length).toBe(2);
						expect(dest2Chunks.length).toBe(2);
						resolve();
					} catch (e) {
						reject(e);
					}
				});

				dest2.on('error', reject);
			});
		});
	});

	describe('Corner cases', () => {
		it('should handle empty or zero-length chunks', async () => {
			const blockify = new StreamBlockify({ blockSize: 10 });

			const source = Readable.from([Buffer.from([]), Buffer.from('ABCDEFGHIJ'), Buffer.from([])]);

			const chunks = await collectChunks(source.pipe(blockify));

			expect(chunks.length).toBe(1);
			expect(chunks[0].toString()).toBe('ABCDEFGHIJ');
		});

		it('should not emit a block if the stream ends with no data', async () => {
			const blockify = new StreamBlockify({ blockSize: 10, onBlock: jest.fn() });

			const source = Readable.from([Buffer.from([])]);

			const chunks = await collectChunks(source.pipe(blockify));

			expect(chunks.length).toBe(0);
			expect(blockify.getPosition()).toBe(0);
		});

		it('should handle multiple back-to-back flush calls', async () => {
			const blockSize = 10;
			const blockify = new StreamBlockify({ blockSize });

			const source = Readable.from([Buffer.from('AB'), Buffer.alloc(0), Buffer.from('CD'), Buffer.alloc(0)]);

			const chunks = await collectChunks(source.pipe(blockify));

			expect(chunks.length).toBe(1);
			expect(chunks[0].toString()).toBe('ABCD');
		});

		it('should handle non-buffer padding values correctly', async () => {
			const invalidValues = [undefined, null, NaN, true, 'string', {}, []];

			for (const value of invalidValues) {
				const blockify = new StreamBlockify({
					blockSize: 10,
					emitPartial: false,
					// @ts-expect-error - Testing with invalid types
					padding: value
				});

				const source = Readable.from([Buffer.from('ABCDE')]);

				await collectChunks(source.pipe(blockify));
			}
		});
	});
});
