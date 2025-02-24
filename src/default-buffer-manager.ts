import { BufferOperationError } from './errors';
import { BufferManager } from './types';

/**
 * DefaultBufferManager implements buffer management for streaming data
 * Handles buffer concatenation, chunking, and remaining data management
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
	 * Memory pool for frequent buffer operations
	 */
	private readonly bufferPool: {
		buffer: Buffer | null;
		size: number;
	} = {
		buffer: null,
		size: 0
	};

	/**
	 * Maximum number of buffers to store before consolidation
	 */
	private readonly MAX_BUFFER_COUNT = 1000;

	/**
	 * Creates a new DefaultBufferManager instance
	 * @param options - Configuration options
	 */
	constructor(options: { poolSize?: number } = {}) {
		// Initialize buffer pool if requested
		if (options.poolSize && options.poolSize > 0) {
			this.bufferPool.buffer = Buffer.allocUnsafe(options.poolSize);
			this.bufferPool.size = options.poolSize;
		}
	}

	/**
	 * Adds a new buffer to the internal buffer collection.
	 * Auto-consolidates buffers if they exceed MAX_BUFFER_COUNT.
	 * @param buffer - The buffer to add.
	 */
	public addBuffer(buffer: Buffer): void {
		if (!buffer || buffer.length === 0) {
			return; // Skip empty buffers
		}

		this.buffers.push(buffer);
		this.totalLength += buffer.length;

		// Consolidate buffers if we have too many to prevent memory fragmentation
		if (this.buffers.length > this.MAX_BUFFER_COUNT) {
			this.consolidateBuffers();
		}
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
	 * @throws {BufferOperationError} If chunk creation fails due to invalid size.
	 */
	public getChunks(chunkSize: number): Buffer[] {
		if (chunkSize <= 0) {
			throw new BufferOperationError('getChunks', `Invalid chunk size: ${chunkSize}. Must be greater than 0.`);
		}

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

		// Optimize for single buffer case
		if (this.buffers.length === 1) {
			return this.getSingleBufferRemaining();
		}

		// For multiple buffers, consolidate them first for efficiency
		this.consolidateBuffers();
		return this.getSingleBufferRemaining();
	}

	/**
	 * Consolidates multiple buffers into a single buffer to reduce fragmentation
	 * and improve performance of subsequent operations.
	 */
	private consolidateBuffers(): void {
		if (this.buffers.length <= 1) {
			return; // Nothing to consolidate
		}

		try {
			// Use our pool if available and big enough
			const shouldUsePool = this.bufferPool.buffer && this.totalLength <= this.bufferPool.size;

			const result: Buffer = shouldUsePool ? this.bufferPool.buffer! : Buffer.allocUnsafe(this.totalLength);

			let offset = 0;

			// Copy first buffer considering the current offset
			const firstBuffer = this.buffers[0];
			const lengthToCopy = firstBuffer.length - this.currentOffset;
			firstBuffer.copy(result, 0, this.currentOffset);
			offset += lengthToCopy;

			// Copy remaining buffers
			for (let i = 1; i < this.buffers.length; i++) {
				const buffer = this.buffers[i];
				buffer.copy(result, offset);
				offset += buffer.length;
			}

			// Replace all buffers with this single consolidated buffer
			this.buffers.length = 0;

			// If we used the pool buffer, create a slice (view) of it
			const consolidatedBuffer = shouldUsePool ? result.slice(0, this.totalLength) : result;

			this.buffers.push(consolidatedBuffer);
			this.currentOffset = 0;
		} catch (error) {
			throw new BufferOperationError('consolidateBuffers', (error as Error).message);
		}
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
	 * Creates a chunk of the specified size from the buffered data.
	 * Uses optimized buffer copying strategies for better performance.
	 * @param size - The size of the chunk to create.
	 * @returns The created chunk or null if there is not enough data.
	 */
	private createChunk(size: number): Buffer | null {
		if (!this.hasEnoughDataForChunk(size)) {
			return null;
		}

		// Use Buffer.allocUnsafe for performance since we'll immediately fill the entire buffer
		const chunk = Buffer.allocUnsafe(size);
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
	 * Optimized for performance with direct Buffer methods.
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
