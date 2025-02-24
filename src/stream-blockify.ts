import { Duplex, DuplexOptions } from 'stream';
import { DefaultBufferManager } from './default-buffer-manager';
import { DefaultStreamStateManager } from './default-stream-state-manager';
import { BufferOperationError, ValidationError, WriteAfterEndError } from './errors';
import { BufferManager, StreamBlockifyConfig, StreamMetrics, StreamStateManager } from './types';

/**
 * StreamBlockify transforms incoming data into fixed-size chunks.
 * It buffers incoming data and emits chunks of a specified size.
 */
export class StreamBlockify extends Duplex {
	/**
	 * Default chunk size if not specified in the configuration.
	 */
	private readonly DEFAULT_CHUNK_SIZE = 512;

	/**
	 * Minimum allowable chunk size
	 */
	private readonly MIN_CHUNK_SIZE = 1;

	/**
	 * Maximum allowable chunk size to prevent memory issues
	 */
	private readonly MAX_CHUNK_SIZE = 1024 * 1024 * 10; // 10MB

	/**
	 * Size of each chunk to be emitted.
	 */
	private readonly chunkSize: number;

	/**
	 * Manager for handling buffer operations.
	 */
	private readonly bufferManager: BufferManager;

	/**
	 * Manager for handling stream state.
	 */
	private readonly stateManager: StreamStateManager;

	/**
	 * Stream metrics for monitoring
	 */
	private metrics: StreamMetrics = {
		totalChunksProcessed: 0,
		totalBytesProcessed: 0,
		currentBufferSize: 0,
		lastProcessingTime: 0
	};

	/**
	 * Maximum buffer size to prevent memory issues
	 */
	private readonly maxBufferSize: number;

	/**
	 * Creates a new StreamBlockify instance.
	 * @param config - Configuration options including chunk size.
	 * @param bufferManager - Optional custom buffer manager.
	 * @param stateManager - Optional custom state manager.
	 * @param streamOptions - Optional Duplex stream configuration options.
	 */
	constructor(
		config: StreamBlockifyConfig = {},
		bufferManager?: BufferManager,
		stateManager?: StreamStateManager,
		streamOptions: DuplexOptions = {}
	) {
		// Pass stream options to parent constructor
		super({
			...streamOptions,
			readableObjectMode: streamOptions.readableObjectMode ?? false,
			writableObjectMode: streamOptions.writableObjectMode ?? false,
			allowHalfOpen: streamOptions.allowHalfOpen ?? true,
			highWaterMark: streamOptions.highWaterMark ?? 16384
		});

		// Validate chunk size
		const providedSize = config.size ?? this.DEFAULT_CHUNK_SIZE;
		if (providedSize < this.MIN_CHUNK_SIZE || providedSize > this.MAX_CHUNK_SIZE) {
			throw new ValidationError(
				'chunkSize',
				`Chunk size must be between ${this.MIN_CHUNK_SIZE} and ${this.MAX_CHUNK_SIZE} bytes`
			);
		}

		this.chunkSize = providedSize;
		this.maxBufferSize = config.maxBufferSize ?? this.chunkSize * 100; // Default to 100x chunk size
		this.bufferManager = bufferManager ?? new DefaultBufferManager();
		this.stateManager = stateManager ?? new DefaultStreamStateManager();

		// Set up event listeners for cleanup
		this.once('end', this.cleanup.bind(this));
		this.once('error', this.cleanup.bind(this));
	}

	/**
	 * Implementation of the _write method required by the Writable interface.
	 * @param chunk - Data to write.
	 * @param encoding - Encoding of the data if chunk is a string.
	 * @param callback - Called when processing is complete.
	 */
	_write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
		try {
			if (this.stateManager.isEnded()) {
				const error = new WriteAfterEndError();
				this.emit('error', error);
				callback(error);
				return;
			}

			// Check if buffer size would exceed maximum
			const bufferSize = this.bufferManager.getTotalLength();
			const chunkSize = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);

			if (bufferSize + chunkSize > this.maxBufferSize) {
				this.stateManager.setNeedDrain(true);
				callback();
				return;
			}

			// Process the incoming data
			this.processChunk(chunk, encoding);

			// Update metrics
			this.metrics.totalBytesProcessed += chunkSize;
			this.metrics.currentBufferSize = this.bufferManager.getTotalLength();

			if (this.stateManager.needsDrain()) {
				callback();
			} else {
				callback();
			}
		} catch (error) {
			callback(error as Error);
		}
	}

	/**
	 * Implementation of the _read method required by the Readable interface.
	 * Emits chunks from the buffer when the consumer is ready to read.
	 */
	_read(_size: number): void {
		if (this.stateManager.isPaused()) {
			this.stateManager.setPaused(false);
		}
		this.emitChunks();
	}

	/**
	 * Writes data to the stream.
	 * @param chunk - Data to write.
	 * @param encoding - Optional encoding if chunk is a string.
	 * @returns boolean indicating if more data can be written.
	 * @throws {WriteAfterEndError} If writing after stream has ended.
	 * @throws {BufferOperationError} If buffer operations fail.
	 */
	public write(
		chunk: Buffer | string,
		encoding?: BufferEncoding | ((error?: Error | null) => void),
		callback?: (error?: Error | null) => void
	): boolean {
		if (typeof encoding === 'function') {
			callback = encoding;
			encoding = undefined;
		}

		return super.write(chunk, encoding as BufferEncoding, callback);
	}

	/**
	 * Pauses the stream, preventing further data from being emitted.
	 */
	public pause(): this {
		this.stateManager.setPaused(true);
		return super.pause();
	}

	/**
	 * Resumes the stream, allowing data to be emitted.
	 */
	public resume(): this {
		this.stateManager.setPaused(false);
		this.emitChunks();
		this.emitDrainIfNeeded();
		return super.resume();
	}

	/**
	 * Ends the stream and flushes remaining data.
	 * @param chunk - Optional final chunk to write before ending.
	 * @param encoding - Optional encoding if chunk is a string.
	 * @param callback - Called when ending is complete.
	 */
	public end(chunk?: any, encoding?: BufferEncoding | (() => void), callback?: () => void): this {
		if (typeof encoding === 'function') {
			callback = encoding;
			encoding = undefined;
		}

		// Set ended state before calling super.end to prevent race conditions
		this.stateManager.setEnded(true);

		// Call super.end which will eventually call _final
		return super.end(chunk, encoding as BufferEncoding, callback);
	}

	/**
	 * Implementation of the _final method required by the Writable interface.
	 * Called before the stream closes, after all data has been written.
	 */
	_final(callback: (error?: Error | null) => void): void {
		try {
			this.flush();
			callback();
		} catch (error) {
			callback(error as Error);
		}
	}

	/**
	 * Flushes any remaining data in the buffer.
	 */
	public flush(): void {
		this.emitChunks(true);
	}

	/**
	 * Returns current metrics about the stream processing.
	 * @returns StreamMetrics object with current metrics.
	 */
	public getMetrics(): StreamMetrics {
		// Update current buffer size
		this.metrics.currentBufferSize = this.bufferManager.getTotalLength();
		return { ...this.metrics };
	}

	/**
	 * Performs cleanup operations when the stream is finished.
	 */
	private cleanup(): void {
		// Ensure we clear any remaining buffers to prevent memory leaks
		this.bufferManager.clear();
	}

	/**
	 * Processes a chunk of data, adding it to the buffer and emitting chunks if necessary.
	 * @param chunk - Data to process.
	 * @param encoding - Encoding of the data if chunk is a string.
	 * @throws {BufferOperationError} If buffer operations fail.
	 */
	private processChunk(chunk: any, encoding?: BufferEncoding): void {
		try {
			const startTime = process.hrtime();

			const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding);

			if (buffer.length) {
				this.bufferManager.addBuffer(buffer);
			}

			if (this.bufferManager.getTotalLength() >= this.chunkSize) {
				if (this.stateManager.isPaused()) {
					this.stateManager.setNeedDrain(true);
					return;
				}
				this.emitChunks();
			}

			// Update processing time metric
			const [seconds, nanoseconds] = process.hrtime(startTime);
			this.metrics.lastProcessingTime = seconds * 1000 + nanoseconds / 1000000;
		} catch (error) {
			this.handleBufferError('processChunk', error as Error);
			throw error;
		}
	}

	/**
	 * Emits chunks of data from the buffer.
	 * @param needToFlush - Whether to flush remaining data.
	 * @throws {BufferOperationError} If buffer operations fail.
	 */
	private emitChunks(needToFlush: boolean = false): void {
		// Use atomic operations pattern to avoid race condition
		if (this.shouldSkipEmission()) {
			return;
		}

		this.stateManager.setEmitting(true);
		try {
			this.emitFullChunks();
			if (needToFlush) {
				this.emitRemainingData();
			}
			this.handleStreamEvents();
		} catch (error) {
			this.handleBufferError('emitChunks', error as Error);
		} finally {
			this.stateManager.setEmitting(false);
		}
	}

	/**
	 * Determines if chunk emission should be skipped.
	 * @returns boolean indicating if emission should be skipped.
	 */
	private shouldSkipEmission(): boolean {
		return this.stateManager.isEmitting() || this.stateManager.isPaused();
	}

	/**
	 * Emits full chunks of data from the buffer.
	 * @throws {BufferOperationError} If buffer operations fail.
	 */
	private emitFullChunks(): void {
		try {
			const chunks = this.bufferManager.getChunks(this.chunkSize);
			for (const chunk of chunks) {
				// Only push if the consumer can accept more data
				const canContinue = this.push(chunk);
				this.metrics.totalChunksProcessed++;

				if (!canContinue) {
					this.stateManager.setPaused(true);
					break;
				}
			}
		} catch (error) {
			throw new BufferOperationError('emitFullChunks', (error as Error).message);
		}
	}

	/**
	 * Emits any remaining data in the buffer.
	 * @throws {BufferOperationError} If buffer operations fail.
	 */
	private emitRemainingData(): void {
		try {
			const remaining = this.bufferManager.getRemainingData();
			if (remaining && remaining.length > 0) {
				this.push(remaining);
				this.bufferManager.clear();

				if (remaining.length < this.chunkSize) {
					this.emit('incompleteChunk', remaining.length);
				} else {
					this.metrics.totalChunksProcessed++;
				}
			}

			// Signal the end of the readable stream if we're ended
			if (this.stateManager.isEnded()) {
				this.push(null);
			}
		} catch (error) {
			throw new BufferOperationError('emitRemainingData', (error as Error).message);
		}
	}

	/**
	 * Handles stream events such as 'drain' and 'end'.
	 */
	private handleStreamEvents(): void {
		this.emitDrainIfNeeded();
		this.emitEndIfNeeded();
	}

	/**
	 * Emits a 'drain' event if needed.
	 */
	private emitDrainIfNeeded(): void {
		if (this.stateManager.needsDrain()) {
			this.stateManager.setNeedDrain(false);
			this.emit('drain');
		}
	}

	/**
	 * Emits an 'end' event if the stream has ended and all data has been emitted.
	 */
	private emitEndIfNeeded(): void {
		if (this.isStreamEnded()) {
			this.stateManager.setEndEmitted(true);
		}
	}

	/**
	 * Checks if the stream has ended and all data has been emitted.
	 * @returns boolean indicating if the stream has ended.
	 */
	private isStreamEnded(): boolean {
		return (
			this.bufferManager.getTotalLength() === 0 &&
			this.stateManager.isEnded() &&
			!this.stateManager.isEndEmitted()
		);
	}

	/**
	 * Handles buffer operation errors by emitting an 'error' event.
	 * @param operation - The operation during which the error occurred.
	 * @param error - The error that occurred.
	 */
	private handleBufferError(operation: string, error: Error): void {
		const bufferError = new BufferOperationError(operation, error.message);
		this.emit('error', bufferError);
	}
}
