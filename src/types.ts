/**
 * Configuration options for StreamBlockify
 */
export interface StreamBlockifyConfig {
	/**
	 * The size of chunks to emit in bytes
	 * @default 512
	 */
	readonly size?: number;
}

/**
 * Represents the possible states of a stream
 */
export interface StreamState {
	/**
	 * Indicates if the stream is currently paused
	 */
	readonly paused: boolean;

	/**
	 * Indicates if the stream has been ended
	 */
	readonly ended: boolean;

	/**
	 * Indicates if the end event has been emitted
	 */
	readonly endEmitted: boolean;

	/**
	 * Indicates if the stream is currently emitting data
	 */
	readonly emitting: boolean;

	/**
	 * Indicates if the stream needs to emit a drain event
	 */
	readonly needDrain: boolean;
}

/**
 * Manages buffer operations for stream data
 */
export interface BufferManager {
	/**
	 * Adds a new buffer to the manager
	 * @param buffer - The buffer to add
	 */
	addBuffer(buffer: Buffer): void;

	/**
	 * Gets the total length of all managed buffers
	 * @returns The total length in bytes
	 */
	getTotalLength(): number;

	/**
	 * Creates fixed-size chunks from the managed buffers
	 * @param size - The size of each chunk in bytes
	 * @returns Array of buffer chunks
	 */
	getChunks(size: number): Buffer[];

	/**
	 * Clears all managed buffers
	 */
	clear(): void;

	/**
	 * Gets any remaining data that doesn't form a complete chunk
	 * @returns Remaining data buffer or null if empty
	 */
	getRemainingData(): Buffer | null;
}

/**
 * Manages the state of a stream
 */
export interface StreamStateManager {
	/**
	 * State query methods
	 */
	isPaused(): boolean;
	isEmitting(): boolean;
	isEnded(): boolean;
	isEndEmitted(): boolean;
	needsDrain(): boolean;

	/**
	 * State mutation methods
	 */
	setPaused(value: boolean): void;
	setEmitting(value: boolean): void;
	setEnded(value: boolean): void;
	setEndEmitted(value: boolean): void;
	setNeedDrain(value: boolean): void;
}

/**
 * Events emitted by StreamBlockify
 */
export interface StreamEvents {
	data: Buffer;
	end: void;
	error: Error;
	drain: void;
}

/**
 * Type helper for stream event handlers
 */
export type StreamEventHandler<T> = T extends void ? () => void : (data: T) => void;

/**
 * Type helper for stream event listeners
 */
export interface StreamEventEmitter {
	on<K extends keyof StreamEvents>(event: K, listener: StreamEventHandler<StreamEvents[K]>): void;

	emit<K extends keyof StreamEvents>(event: K, ...args: StreamEvents[K] extends void ? [] : [StreamEvents[K]]): void;
}
