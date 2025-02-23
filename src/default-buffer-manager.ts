import { BufferManager } from './types';

/**
 * DefaultBufferManager implements buffer management for streaming data
 * Handles buffer concatenation, chunking, and remaining data management
 */
/**
 * DefaultBufferManager is a class that manages a collection of buffers,
 * allowing for the addition of new buffers, retrieval of total length,
 * creation of fixed-size chunks, and retrieval of remaining data.
 */
export class DefaultBufferManager implements BufferManager {
	/**
	 * Internal collection of buffers.
	 */
	private readonly buffers: Buffer[] = [];

	/**
	 * Total length of all buffers combined.
	 */
	private totalLength = 0;

	/**
	 * Current offset within the first buffer.
	 */
	private currentOffset = 0;

	/**
	 * Adds a new buffer to the internal buffer collection.
	 * @param buffer - The buffer to add.
	 */
	public addBuffer(buffer: Buffer): void {
		this.buffers.push(buffer);
		this.totalLength += buffer.length;
	}

	/**
	 * Returns the total length of all buffers.
	 * @returns The total length of all buffers.
	 */
	public getTotalLength(): number {
		return this.totalLength;
	}

	/**
	 * Creates fixed-size chunks from the buffered data.
	 * @param chunkSize - Size of each chunk to create.
	 * @returns Array of buffer chunks.
	 */
	public getChunks(chunkSize: number): Buffer[] {
		if (!this.isValidChunkOperation(chunkSize)) {
			return [];
		}

		const chunks: Buffer[] = [];
		while (this.hasEnoughDataForChunk(chunkSize)) {
			const chunk = this.createChunk(chunkSize);
			if (!chunk) break;
			chunks.push(chunk);
		}

		return chunks;
	}

	/**
	 * Clears all internal buffers and resets state.
	 */
	public clear(): void {
		this.buffers.length = 0; // More efficient than reassignment
		this.totalLength = 0;
		this.currentOffset = 0;
	}

	/**
	 * Retrieves any remaining data that doesn't form a complete chunk.
	 * @returns Buffer containing remaining data or null if empty.
	 */
	public getRemainingData(): Buffer | null {
		if (this.totalLength === 0) {
			return null;
		}

		return this.buffers.length === 1 ? this.getSingleBufferRemaining() : this.getMultiBufferRemaining();
	}

	/**
	 * Checks if the chunk operation is valid.
	 * @param size - The size of the chunk.
	 * @returns True if the chunk operation is valid, otherwise false.
	 */
	private isValidChunkOperation(size: number): boolean {
		return size > 0 && this.totalLength > 0;
	}

	/**
	 * Checks if there is enough data for a chunk of the given size.
	 * @param size - The size of the chunk.
	 * @returns True if there is enough data for the chunk, otherwise false.
	 */
	private hasEnoughDataForChunk(size: number): boolean {
		return this.totalLength >= size;
	}

	/**
	 * Retrieves the remaining data from a single buffer.
	 * @returns Buffer containing the remaining data.
	 */
	private getSingleBufferRemaining(): Buffer {
		const buffer = this.buffers[0];
		return this.currentOffset ? buffer.subarray(this.currentOffset) : buffer;
	}

	/**
	 * Retrieves the remaining data from multiple buffers.
	 * @returns Buffer containing the remaining data.
	 */
	private getMultiBufferRemaining(): Buffer {
		const result = Buffer.alloc(this.totalLength);
		let outputOffset = 0;

		for (let i = 0; i < this.buffers.length; i++) {
			const buffer = this.buffers[i];
			const start = i === 0 ? this.currentOffset : 0;
			const length = buffer.length - start;

			buffer.copy(result, outputOffset, start);
			outputOffset += length;
		}

		return result;
	}

	/**
	 * Creates a chunk of the specified size from the buffered data.
	 * @param size - The size of the chunk to create.
	 * @returns The created chunk or null if there is not enough data.
	 */
	private createChunk(size: number): Buffer | null {
		if (!this.hasEnoughDataForChunk(size)) {
			return null;
		}

		const chunk = Buffer.alloc(size);
		let chunkOffset = 0;
		let remainingSize = size;

		while (remainingSize > 0 && this.buffers.length > 0) {
			const copyResult = this.copyToChunk(chunk, chunkOffset, remainingSize);
			if (!copyResult) break;

			const { copiedLength, chunkOffsetDelta } = copyResult;
			chunkOffset += chunkOffsetDelta;
			remainingSize -= copiedLength;
		}

		this.totalLength -= size;
		return chunk;
	}

	/**
	 * Copies data to the chunk from the current buffer.
	 * @param chunk - The chunk to copy data to.
	 * @param chunkOffset - The current offset within the chunk.
	 * @param remainingSize - The remaining size to be copied.
	 * @returns An object containing the copied length and chunk offset delta, or null if there is no current buffer.
	 */
	private copyToChunk(
		chunk: Buffer,
		chunkOffset: number,
		remainingSize: number
	): { copiedLength: number; chunkOffsetDelta: number } | null {
		const currentBuffer = this.buffers[0];
		if (!currentBuffer) return null;

		const availableLength = currentBuffer.length - this.currentOffset;
		const copyLength = Math.min(availableLength, remainingSize);

		currentBuffer.copy(chunk, chunkOffset, this.currentOffset, this.currentOffset + copyLength);

		this.currentOffset += copyLength;

		if (this.currentOffset >= currentBuffer.length) {
			this.buffers.shift();
			this.currentOffset = 0;
		}

		return {
			copiedLength: copyLength,
			chunkOffsetDelta: copyLength
		};
	}
}
