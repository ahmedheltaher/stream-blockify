import { StreamState, StreamStateManager } from './types';

/**
 * Manages the state of a stream with type-safe operations
 * Provides a clear interface for state transitions and queries
 */
export class DefaultStreamStateManager implements StreamStateManager {
	private state: StreamState = {
		paused: false,
		ended: false,
		endEmitted: false,
		emitting: false,
		needDrain: false
	};

	/**
	 * State query methods
	 */
	public isPaused(): boolean {
		return this.state.paused;
	}

	public isEmitting(): boolean {
		return this.state.emitting;
	}

	public isEnded(): boolean {
		return this.state.ended;
	}

	public isEndEmitted(): boolean {
		return this.state.endEmitted;
	}

	public needsDrain(): boolean {
		return this.state.needDrain;
	}

	/**
	 * State mutation methods
	 */
	public setPaused(value: boolean): void {
		this.updateState('paused', value);
	}

	public setEmitting(value: boolean): void {
		this.updateState('emitting', value);
	}

	public setEnded(value: boolean): void {
		this.updateState('ended', value);
	}

	public setEndEmitted(value: boolean): void {
		this.updateState('endEmitted', value);
	}

	public setNeedDrain(value: boolean): void {
		this.updateState('needDrain', value);
	}

	/**
	 * Returns a readonly copy of the current state
	 */
	public getState(): Readonly<StreamState> {
		return { ...this.state };
	}

	/**
	 * Updates a single state property in an immutable way
	 */
	private updateState<K extends keyof StreamState>(key: K, value: StreamState[K]): void {
		this.state = {
			...this.state,
			[key]: value
		};
	}
}
