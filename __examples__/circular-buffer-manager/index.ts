// examples/circular-buffer-manager.ts

import { BufferManager, StreamBlockify } from '../../src';

/**
 * Implements a circular buffer for memory-efficient stream processing
 * Useful for scenarios with fixed memory requirements and continuous data flow
 */
export class CircularBufferManager implements BufferManager {
	private readonly buffer: Buffer;
	private writePos = 0;
	private readPos = 0;
	private dataLength = 0;

	constructor(size: number) {
		if (!Number.isInteger(size) || size <= 0) {
			throw new Error('Buffer size must be a positive integer');
		}
		this.buffer = Buffer.alloc(size);
	}

	public addBuffer(data: Buffer): void {
		const available = this.buffer.length - this.dataLength;
		if (data.length > available) {
			throw new Error(
				`Buffer overflow: trying to write ${data.length} bytes with only ${available} bytes available`
			);
		}

		// Handle wrap-around write
		const writeToEnd = Math.min(data.length, this.buffer.length - this.writePos);
		data.copy(this.buffer, this.writePos, 0, writeToEnd);

		if (writeToEnd < data.length) {
			// Write remaining data at buffer start
			data.copy(this.buffer, 0, writeToEnd);
			this.writePos = data.length - writeToEnd;
		} else {
			this.writePos = (this.writePos + writeToEnd) % this.buffer.length;
		}

		this.dataLength += data.length;
	}

	public getTotalLength(): number {
		return this.dataLength;
	}

	public getChunks(size: number): Buffer[] {
		if (size <= 0) return [];

		const chunks: Buffer[] = [];
		while (this.dataLength >= size) {
			const chunk = Buffer.alloc(size);
			this.readChunk(chunk);
			chunks.push(chunk);
			this.dataLength -= size;
			this.readPos = (this.readPos + size) % this.buffer.length;
		}
		return chunks;
	}

	public getRemainingData(): Buffer | null {
		if (this.dataLength === 0) return null;

		const result = Buffer.alloc(this.dataLength);
		this.readChunk(result);
		return result;
	}

	public clear(): void {
		this.writePos = 0;
		this.readPos = 0;
		this.dataLength = 0;
	}

	private readChunk(target: Buffer): void {
		const readToEnd = Math.min(target.length, this.buffer.length - this.readPos);
		this.buffer.copy(target, 0, this.readPos, this.readPos + readToEnd);

		if (readToEnd < target.length) {
			// Read remaining data from buffer start
			this.buffer.copy(target, readToEnd, 0, target.length - readToEnd);
		}
	}

	// Helper method to get buffer statistics
	public getStats(): Record<string, number> {
		return {
			capacity: this.buffer.length,
			used: this.dataLength,
			available: this.buffer.length - this.dataLength,
			writePosition: this.writePos,
			readPosition: this.readPos
		};
	}
}

// Example usage
async function demonstrateCircularBuffer() {
	// Create a circular buffer manager with 1MB capacity
	const bufferManager = new CircularBufferManager(1024 * 2);
	const blockifier = new StreamBlockify({ size: 1024 }, bufferManager);

	// Monitor chunk processing
	blockifier.on('data', chunk => {
		// eslint-disable-next-line no-console
		console.log(`Processed chunk: ${chunk.length} bytes`);
		// eslint-disable-next-line no-console
		console.log('Buffer stats:', bufferManager.getStats());
		// eslint-disable-next-line no-console
		console.log(`data: ${Buffer.from(chunk)}`);
	});

	// Simulate streaming data
	for (let i = 0; i < 10; i++) {
		const data = Buffer.alloc(512).fill(65 + i);
		const canWrite = blockifier.write(data);

		if (!canWrite) {
			await new Promise(resolve => blockifier.once('drain', resolve));
		}
	}

	blockifier.end();
}
if (require.main === module) {
	// eslint-disable-next-line no-console
	demonstrateCircularBuffer().catch(console.error);
}
