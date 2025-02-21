import { StreamBlockifyState, StreamStateManager } from './types';

export class DefaultStreamStateManager implements StreamStateManager {
	private readonly _state: StreamBlockifyState = {
		paused: false,
		ended: false,
		endEmitted: false,
		emitting: false,
		needDrain: false
	};

	public isPaused(): boolean {
		return this._state.paused;
	}

	public isEmitting(): boolean {
		return this._state.emitting;
	}

	public isEnded(): boolean {
		return this._state.ended;
	}

	public isEndEmitted(): boolean {
		return this._state.endEmitted;
	}

	public needsDrain(): boolean {
		return this._state.needDrain;
	}

	public setPaused(paused: boolean): void {
		this._state.paused = paused;
	}

	public setEmitting(emitting: boolean): void {
		this._state.emitting = emitting;
	}

	public setEnded(ended: boolean): void {
		this._state.ended = ended;
	}

	public setEndEmitted(endEmitted: boolean): void {
		this._state.endEmitted = endEmitted;
	}

	public setNeedDrain(needDrain: boolean): void {
		this._state.needDrain = needDrain;
	}
}
