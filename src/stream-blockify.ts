import { Duplex } from 'stream';
import { DefaultBufferManager } from './default-buffer-manager';
import { DefaultStreamStateManager } from './default-stream-state-manager';
import { BufferOperationError, WriteAfterEndError } from './errors';
import { BufferManager, StreamBlockifyConfig, StreamStateManager } from './types';

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
	 * Creates a new StreamBlockify instance.
	 * @param config - Configuration options including chunk size.
	 * @param bufferManager - Optional custom buffer manager.
	 * @param stateManager - Optional custom state manager.
	 */
	constructor(config: StreamBlockifyConfig = {}, bufferManager?: BufferManager, stateManager?: StreamStateManager) {
		super();
		this.chunkSize = config.size ?? this.DEFAULT_CHUNK_SIZE;
		this.bufferManager = bufferManager ?? new DefaultBufferManager();
		this.stateManager = stateManager ?? new DefaultStreamStateManager();
	}

	/**
	 * Writes data to the stream.
	 * @param chunk - Data to write.
	 * @returns boolean indicating if more data can be written.
	 * @throws {WriteAfterEndError} If writing after stream has ended.
	 * @throws {BufferOperationError} If buffer operations fail.
	 */
	public write(chunk: Buffer | string): boolean {
		this.validateWriteOperation();
		if (this.stateManager.isPaused()) {
			this.stateManager.setNeedDrain(true);
			return false;
		}

		try {
			this.processChunk(chunk);
			return true;
		} catch (error) {
			this.handleBufferError('write', error as Error);
			throw error; // Re-throw to maintain original behavior
		}
	}

	/**
	 * Pauses the stream, preventing further data from being emitted.
	 */
	public pause(): this {
		this.stateManager.setPaused(true);
		return this;
	}

	/**
	 * Resumes the stream, allowing data to be emitted.
	 */
	public resume(): this {
		this.stateManager.setPaused(false);
		this.emitChunks();
		this.emitDrainIfNeeded();
		return this;
	}

	/**
	 * Ends the stream and flushes remaining data.
	 * @param chunk - Optional final chunk to write before ending.
	 */
	public end(chunk?: any, encoding?: BufferEncoding | (() => void), callback?: () => void): this {
		if (typeof encoding === 'function') {
			callback = encoding;
			encoding = undefined;
		}
		if (chunk) {
			this.write(chunk);
		}
		this.stateManager.setEnded(true);
		this.flush();
		if (callback) callback();
		return this;
	}

	/**
	 * Flushes any remaining data in the buffer.
	 */
	public flush(): void {
		this.emitChunks(true);
	}

	/**
	 * Validates if a write operation can be performed.
	 * @throws {WriteAfterEndError} If the stream has already ended.
	 */
	private validateWriteOperation(): void {
		if (!this.stateManager.isEnded()) {
			return;
		}
		const error = new WriteAfterEndError();
		this.emit('error', error);
		throw error;
	}

	/**
	 * Processes a chunk of data, adding it to the buffer and emitting chunks if necessary.
	 * @param chunk - Data to process.
	 * @throws {BufferOperationError} If buffer operations fail.
	 */
	private processChunk(chunk: Buffer | string): void {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
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
	}

	/**
	 * Emits chunks of data from the buffer.
	 * @param needToFlush - Whether to flush remaining data.
	 * @throws {BufferOperationError} If buffer operations fail.
	 */
	private emitChunks(needToFlush: boolean = false): void {
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
			chunks.forEach(chunk => this.emit('data', chunk));
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
			if (remaining) {
				this.emit('data', remaining);
				this.bufferManager.clear();
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
			this.emit('end');
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
