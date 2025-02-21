import { Stream } from 'stream';
import { DefaultBufferManager } from './default-buffer-manager';
import { DefaultStreamStateManager } from './default-stream-state-manager';
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
			throw new Error('StreamBlockify: write after end');
		}

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

		return true;
	}

	public pause(): void {
		this._stateManager.setPaused(true);
	}

	public resume(): void {
		this._stateManager.setPaused(false);
		this._emitChunks();
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
			this.emit('error', error);
		} finally {
			this._stateManager.setEmitting(false);
		}
	}

	private _emitFullChunks(): void {
		const chunks = this._bufferManager.getChunks(this._chunkSize);
		chunks.forEach(chunk => this.emit('data', chunk));
	}

	private emitRemainingData(): void {
		const remaining = this._bufferManager.getRemainingData();
		if (remaining) {
			this.emit('data', remaining);
			this._bufferManager.clear();
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
