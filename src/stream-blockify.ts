import { Stream } from 'stream';
import { DefaultBufferManager } from './default-buffer-manager';
import { DefaultStreamStateManager } from './default-stream-state-manager';
import { BufferOperationError, WriteAfterEndError } from './errors';
import { BufferManager, StreamBlockifyConfig, StreamStateManager } from './types';

/**
 * StreamBlockify transforms incoming data into fixed-size chunks.
 * It buffers incoming data and emits chunks of a specified size.
 */
export class StreamBlockify extends Stream {
	// Make these readonly since they shouldn't change after initialization
	private readonly DEFAULT_CHUNK_SIZE = 512;
	private readonly chunkSize: number;
	private readonly bufferManager: BufferManager;
	private readonly stateManager: StreamStateManager;

	/**
	 * Creates a new StreamBlockify instance
	 * @param config - Configuration options including chunk size
	 * @param bufferManager - Optional custom buffer manager
	 * @param stateManager - Optional custom state manager
	 */
	constructor(config: StreamBlockifyConfig = {}, bufferManager?: BufferManager, stateManager?: StreamStateManager) {
		super();
		this.chunkSize = config.size ?? this.DEFAULT_CHUNK_SIZE;
		this.bufferManager = bufferManager ?? new DefaultBufferManager();
		this.stateManager = stateManager ?? new DefaultStreamStateManager();
	}

	/**
	 * Writes data to the stream
	 * @param chunk - Data to write
	 * @returns boolean indicating if more data can be written
	 * @throws {WriteAfterEndError} If writing after stream has ended
	 * @throws {BufferOperationError} If buffer operations fail
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

	public pause(): void {
		this.stateManager.setPaused(true);
	}

	public resume(): void {
		this.stateManager.setPaused(false);
		this.emitChunks();
		this.emitDrainIfNeeded();
	}

	/**
	 * Ends the stream and flushes remaining data
	 * @param chunk - Optional final chunk to write before ending
	 */
	public end(chunk?: Buffer | string): void {
		if (chunk) {
			this.write(chunk);
		}
		this.stateManager.setEnded(true);
		this.flush();
	}

	/**
	 * Flushes any remaining data in the buffer
	 */
	public flush(): void {
		this.emitChunks(true);
	}

	private validateWriteOperation(): void {
		if (this.stateManager.isEnded()) {
			const error = new WriteAfterEndError();
			this.emit('error', error);
			throw error;
		}
	}

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

	private shouldSkipEmission(): boolean {
		return this.stateManager.isEmitting() || this.stateManager.isPaused();
	}

	private emitFullChunks(): void {
		try {
			const chunks = this.bufferManager.getChunks(this.chunkSize);
			chunks.forEach(chunk => this.emit('data', chunk));
		} catch (error) {
			throw new BufferOperationError('emitFullChunks', (error as Error).message);
		}
	}

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

	private handleStreamEvents(): void {
		this.emitDrainIfNeeded();
		this.emitEndIfNeeded();
	}

	private emitDrainIfNeeded(): void {
		if (this.stateManager.needsDrain()) {
			this.stateManager.setNeedDrain(false);
			this.emit('drain');
		}
	}

	private emitEndIfNeeded(): void {
		if (this.isStreamEnded()) {
			this.stateManager.setEndEmitted(true);
			this.emit('end');
		}
	}

	private isStreamEnded(): boolean {
		return (
			this.bufferManager.getTotalLength() === 0 &&
			this.stateManager.isEnded() &&
			!this.stateManager.isEndEmitted()
		);
	}

	private handleBufferError(operation: string, error: Error): void {
		const bufferError = new BufferOperationError(operation, error.message);
		this.emit('error', bufferError);
	}
}
