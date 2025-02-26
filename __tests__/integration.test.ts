import * as crypto from 'node:crypto';
import { Readable, Transform, Writable, pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { StreamBlockify } from '../src/stream-blockify';

const pipelineAsync = promisify(pipeline);

describe('StreamBlockify Integration and Performance Tests', () => {
	const createRandomBuffer = (size: number): Buffer => {
		return crypto.randomBytes(size);
	};

	const createRandomStream = (totalSize: number, chunkSize: number): Readable => {
		let bytesEmitted = 0;

		return new Readable({
			read() {
				if (bytesEmitted >= totalSize) {
					this.push(null);
					return;
				}

				const size = Math.min(chunkSize, totalSize - bytesEmitted);
				const chunk = createRandomBuffer(size);
				bytesEmitted += size;
				this.push(chunk);
			}
		});
	};

	const createCountingStream = (): [Writable, () => number] => {
		let bytesWritten = 0;

		const stream = new Writable({
			write(chunk, _encoding, callback) {
				bytesWritten += chunk.length;
				callback();
			}
		});

		return [stream, () => bytesWritten];
	};

	describe('large data handling', () => {
		it('should handle large data streams efficiently', async () => {
			const totalSize = 10 * 1024 * 1024;
			const blockSize = 64 * 1024;

			const source = createRandomStream(totalSize, 1024 * 1024);
			const [destination, getBytesWritten] = createCountingStream();

			const blockify = new StreamBlockify({ blockSize });

			await pipelineAsync(source, blockify, destination);

			expect(getBytesWritten()).toBe(totalSize);
		}, 30_000);

		it('should correctly process data with various block sizes', async () => {
			const testSizes = [
				{ total: 1000, block: 10 },
				{ total: 1000, block: 100 },
				{ total: 1000, block: 1000 },
				{ total: 1024, block: 256 }
			];

			for (const { total, block } of testSizes) {
				const source = createRandomStream(total, Math.ceil(total / 10));
				const [destination, getBytesWritten] = createCountingStream();

				const blockify = new StreamBlockify({
					blockSize: block,
					emitPartial: true
				});

				await pipelineAsync(source, blockify, destination);

				expect(getBytesWritten()).toBe(total);
			}
		});
	});

	describe('backpressure handling', () => {
		it('should handle backpressure correctly', async () => {
			const totalSize = 1 * 1024 * 1024;
			const blockSize = 64 * 1024;

			const source = createRandomStream(totalSize, 128 * 1024);

			const slowDestination = new Writable({
				highWaterMark: 32 * 1024,
				write(_chunk, _encoding, callback) {
					setTimeout(() => callback(), 10);
				}
			});

			const blockify = new StreamBlockify({
				blockSize,
				maximumBufferedBlocks: 4
			});

			await pipelineAsync(source, blockify, slowDestination);
		}, 15_000);
	});

	describe('practical use cases', () => {
		it('should work for block cipher encryption', async () => {
			const blockSize = 16;
			const totalSize = 1000 * blockSize;

			const source = createRandomStream(totalSize, 100);

			const blockify = new StreamBlockify({
				blockSize,
				emitPartial: false,
				padding: 0,
				blockTransform: block => {
					return Buffer.from(block.reverse());
				}
			});

			const [destination, getBytesWritten] = createCountingStream();

			await pipelineAsync(source, blockify, destination);

			expect(getBytesWritten() % blockSize).toBe(0);
			expect(getBytesWritten()).toBeGreaterThanOrEqual(totalSize);
		});

		it('should maintain data integrity across transformations', async () => {
			const blockSize = 1024;
			const data = createRandomBuffer(10 * blockSize + 100);

			const source = Readable.from([data]);

			let processedBytes = 0;
			let lastBlockSize = 0;

			const blockify = new StreamBlockify({
				blockSize,
				emitPartial: true,
				onBlock: block => {
					processedBytes += block.length;
					lastBlockSize = block.length;
				}
			});

			const [destination, getBytesWritten] = createCountingStream();

			await pipelineAsync(source, blockify, destination);

			expect(getBytesWritten()).toBe(data.length);
			expect(processedBytes).toBe(data.length);
			expect(lastBlockSize).toBe(100);
		});
	});

	describe('compatibility with node streams', () => {
		it('should work with custom encoding transformations', async () => {
			const blockSize = 6;
			const data = Buffer.from('Hello, world! This is a test of stream encoding compatibility.');

			const createSource = (data: Buffer) => Readable.from([data]);
			const createBase64Encoder = () =>
				new Transform({
					transform(
						chunk: Buffer,
						_encoding: BufferEncoding,
						callback: (error?: Error | null, data?: any) => void
					): void {
						callback(null, chunk.toString('base64'));
					}
				});
			const createBlockify = (blockSize: number) => new StreamBlockify({ blockSize });

			let outputChunks: Buffer[] = [];
			const collector1 = new Writable({
				write(chunk, _encoding, callback) {
					outputChunks.push(Buffer.from(chunk));
					callback();
				}
			});

			await pipelineAsync(createSource(data), createBlockify(blockSize), createBase64Encoder(), collector1);

			const base64Data = Buffer.concat(outputChunks).toString();
			expect(Buffer.from(base64Data, 'base64').toString()).toBe(data.toString());

			outputChunks = [];
			const collector2 = new Writable({
				write(chunk, _encoding, callback) {
					outputChunks.push(Buffer.from(chunk));
					callback();
				}
			});

			await pipelineAsync(createSource(data), createBase64Encoder(), createBlockify(blockSize), collector2);

			const finalData = Buffer.concat(outputChunks).toString();
			expect(Buffer.from(finalData, 'base64').toString()).toBe(data.toString());
		});
	});
});
