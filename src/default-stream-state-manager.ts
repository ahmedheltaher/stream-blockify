import { StreamState, StreamStateManager } from './types';

/**
 * Manages the state of a stream, providing methods to query and mutate the state.
 * The state includes properties such as paused, ended, endEmitted, emitting, and needDrain.
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
	 * Checks if the stream is paused.
	 * @returns {boolean} True if the stream is paused, false otherwise.
	 */
	public isPaused(): boolean {
		return this.state.paused;
	}

	/**
	 * Checks if the stream is currently emitting data.
	 * @returns {boolean} True if the stream is emitting, false otherwise.
	 */
	public isEmitting(): boolean {
		return this.state.emitting;
	}

	/**
	 * Checks if the stream has ended.
	 * @returns {boolean} True if the stream has ended, false otherwise.
	 */
	public isEnded(): boolean {
		return this.state.ended;
	}

	/**
	 * Checks if the end event has been emitted.
	 * @returns {boolean} True if the end event has been emitted, false otherwise.
	 */
	public isEndEmitted(): boolean {
		return this.state.endEmitted;
	}

	/**
	 * Checks if the stream needs to be drained.
	 * @returns {boolean} True if the stream needs to be drained, false otherwise.
	 */
	public needsDrain(): boolean {
		return this.state.needDrain;
	}

	/**
	 * Sets the paused state of the stream.
	 * @param {boolean} value - The new paused state.
	 */
	public setPaused(value: boolean): void {
		this.updateState('paused', value);
	}

	/**
	 * Sets the emitting state of the stream.
	 * @param {boolean} value - The new emitting state.
	 */
	public setEmitting(value: boolean): void {
		this.updateState('emitting', value);
	}

	/**
	 * Sets the ended state of the stream.
	 * @param {boolean} value - The new ended state.
	 */
	public setEnded(value: boolean): void {
		this.updateState('ended', value);
	}

	/**
	 * Sets the endEmitted state of the stream.
	 * @param {boolean} value - The new endEmitted state.
	 */
	public setEndEmitted(value: boolean): void {
		this.updateState('endEmitted', value);
	}

	/**
	 * Sets the needDrain state of the stream.
	 * @param {boolean} value - The new needDrain state.
	 */
	public setNeedDrain(value: boolean): void {
		this.updateState('needDrain', value);
	}

	/**
	 * Returns a readonly copy of the current state.
	 * @returns {Readonly<StreamState>} A readonly copy of the current state.
	 */
	public getState(): Readonly<StreamState> {
		return { ...this.state };
	}

	/**
	 * Updates a single state property in an immutable way.
	 * @param {K} key - The key of the state property to update.
	 * @param {StreamState[K]} value - The new value of the state property.
	 */
	private updateState<K extends keyof StreamState>(key: K, value: StreamState[K]): void {
		this.state = {
			...this.state,
			[key]: value
		};
	}
}
