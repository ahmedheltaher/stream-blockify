import { Stream } from 'stream';
import { DefaultBufferManager } from './default-buffer-manager';
import { DefaultStreamStateManager } from './default-stream-state-manager';
import { BufferOperationError, WriteAfterEndError } from './errors';
import { BufferManager, StreamBlockifyConfig, StreamStateManager } from './types';

export class StreamBlockify extends Stream {
	public readonly _writable: boolean = true;
	public readonly _readable: boolean = true;

	private readonly _chunkSize: number;
	private readonly _bufferManager: BufferManager;
	private readonly _stateManager: StreamStateManager;

	constructor(config: StreamBlockifyConfig = {}, bufferManager?: BufferManager, stateManager?: StreamStateManager) {
		super();
		const { size = 512 } = config;
		this._chunkSize = size;
		this._bufferManager = bufferManager ?? new DefaultBufferManager();
		this._stateManager = stateManager ?? new DefaultStreamStateManager();
	}

	public write(chunk: Buffer | string): boolean {
		if (this._stateManager.isEnded()) {
			const error = new WriteAfterEndError();
			this.emit('error', error);
			throw error;
		}

		if (this._stateManager.isPaused()) {
			this._stateManager.setNeedDrain(true);
			return false;
		}

		try {
			const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
			if (buffer.length) {
				this._bufferManager.addBuffer(buffer);
			}

			if (this._bufferManager.getTotalLength() >= this._chunkSize) {
				if (this._stateManager.isPaused()) {
					this._stateManager.setNeedDrain(true);
					return false;
				}
				this._emitChunks();
			}
		} catch (error) {
			const bufferError = new BufferOperationError('write', (error as Error).message);
			this.emit('error', bufferError);
			throw bufferError;
		}

		return true;
	}

	public pause(): void {
		this._stateManager.setPaused(true);
	}

	public resume(): void {
		this._stateManager.setPaused(false);
		this._emitChunks();
		if (this._stateManager.needsDrain()) {
			this._stateManager.setNeedDrain(false);
			this.emit('drain');
		}
	}

	public end(chunk?: Buffer | string): void {
		if (chunk) {
			this.write(chunk);
		}
		this._stateManager.setEnded(true);
		this.flush();
	}

	public flush(): void {
		this._emitChunks(true);
	}

	private _emitChunks(needToFlush: boolean = false): void {
		if (this._stateManager.isEmitting() || this._stateManager.isPaused()) {
			return;
		}

		this._stateManager.setEmitting(true);

		try {
			this._emitFullChunks();
			if (needToFlush) {
				this.emitRemainingData();
			}
			this._handleEvents();
		} catch (error) {
			const bufferError = new BufferOperationError('_emitChunks', (error as Error).message);
			this.emit('error', bufferError);
		} finally {
			this._stateManager.setEmitting(false);
		}
	}

	private _emitFullChunks(): void {
		try {
			const chunks = this._bufferManager.getChunks(this._chunkSize);
			chunks.forEach(chunk => this.emit('data', chunk));
		} catch (error) {
			throw new BufferOperationError('_emitFullChunks', (error as Error).message);
		}
	}

	private emitRemainingData(): void {
		try {
			const remaining = this._bufferManager.getRemainingData();
			if (remaining) {
				this.emit('data', remaining);
				this._bufferManager.clear();
			}
		} catch (error) {
			throw new BufferOperationError('emitRemainingData', (error as Error).message);
		}
	}

	private _handleEvents(): void {
		if (this._stateManager.needsDrain()) {
			this._stateManager.setNeedDrain(false);
			this.emit('drain');
		}

		if (this._isEnded()) {
			this._stateManager.setEndEmitted(true);
			this.emit('end');
		}
	}

	private _isEnded() {
		return (
			this._bufferManager.getTotalLength() === 0 &&
			this._stateManager.isEnded() &&
			!this._stateManager.isEndEmitted()
		);
	}
}
