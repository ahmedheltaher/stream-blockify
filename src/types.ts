/**
 * @packageDocumentation
 * Core type definitions and interfaces for the StreamBlockify library.
 * Contains configuration types, state management interfaces, and event handling definitions.
 */

/**
 * Configuration options for initializing a StreamBlockify instance.
 * Allows customization of chunk sizes and processing behavior.
 *
 * @interface StreamBlockifyConfig
 * @category Configuration
 *
 * @example
 * ```typescript
 * const config: StreamBlockifyConfig = {
 *   size: 1024, // Create 1KB chunks
 *   maxBufferSize: 1024 * 100, // Maximum buffer size of 100KB
 *   flushMode: 'complete' // Only emit complete chunks unless end() is called
 * };
 * const blockifier = new StreamBlockify(config);
 * ```
 */
export interface StreamBlockifyConfig {
	/**
	 * The size of chunks to emit in bytes. Controls the granularity of data transformation.
	 *
	 * @default 512
	 * @remarks
	 * - Choose a size that balances memory usage and performance
	 * - Powers of 2 (512, 1024, 2048, etc.) are recommended for optimal memory alignment
	 * - Larger sizes improve throughput but increase memory usage
	 * - Smaller sizes provide finer control but may impact performance
	 */
	readonly size?: number;

	/**
	 * Maximum size of the internal buffer in bytes.
	 * When this limit is reached, backpressure is applied.
	 *
	 * @default size * 100
	 * @remarks
	 * - Prevents unbounded memory growth
	 * - Should be set based on available system memory and expected throughput
	 */
	readonly maxBufferSize?: number;

	/**
	 * Determines how the stream handles incomplete chunks when flushing.
	 *
	 * @default 'auto'
	 */
	readonly flushMode?: 'auto' | 'complete' | 'partial';
}

/**
 * Metrics for monitoring stream processing performance and state.
 *
 * @interface StreamMetrics
 * @category Monitoring
 *
 * @example
 * ```typescript
 * const stream = new StreamBlockify();
 * // ... process some data ...
 * const metrics = stream.getMetrics();
 * console.log(`Processed ${metrics.totalChunksProcessed} chunks`);
 * ```
 */
export interface StreamMetrics {
	/**
	 * Total number of chunks processed by the stream.
	 */
	totalChunksProcessed: number;

	/**
	 * Total number of bytes processed by the stream.
	 */
	totalBytesProcessed: number;

	/**
	 * Current size of the internal buffer in bytes.
	 */
	currentBufferSize: number;

	/**
	 * Last time the stream processed data in milliseconds.
	 */
	lastProcessingTime: number;
}

/**
 * Represents the complete internal state of a stream during its lifecycle.
 * Used by StreamStateManager to track stream conditions and control flow.
 *
 * @interface StreamState
 * @category State Management
 *
 * @example
 * ```typescript
 * const state: StreamState = {
 *   paused: false,
 *   ended: false,
 *   endEmitted: false,
 *   emitting: false,
 *   needDrain: false
 * };
 * ```
 */
export interface StreamState {
	/**
	 * Indicates if the stream is currently paused.
	 * When true, incoming data will be buffered but not emitted.
	 */
	readonly paused: boolean;

	/**
	 * Indicates if the stream has been marked as ended.
	 * Once true, no more data can be written to the stream.
	 */
	readonly ended: boolean;

	/**
	 * Tracks whether the 'end' event has been emitted.
	 * Prevents multiple end event emissions.
	 */
	readonly endEmitted: boolean;

	/**
	 * Indicates if the stream is actively emitting data chunks.
	 * Used to prevent concurrent emissions.
	 */
	readonly emitting: boolean;

	/**
	 * Signals that backpressure has built up and drain is needed.
	 * Used for flow control in high-throughput scenarios.
	 */
	readonly needDrain: boolean;
}

/**
 * Defines the interface for managing stream buffer operations.
 * Implementations handle buffer concatenation, chunking, and data management.
 *
 * @interface BufferManager
 * @category Buffer Management
 *
 * @example
 * ```typescript
 * class CustomBufferManager implements BufferManager {
 *   private buffers: Buffer[] = [];
 *
 *   addBuffer(buffer: Buffer): void {
 *     this.buffers.push(buffer);
 *   }
 *
 *   getTotalLength(): number {
 *     return this.buffers.reduce((total, buf) => total + buf.length, 0);
 *   }
 *
 *   // Additional method implementations...
 * }
 * ```
 */
export interface BufferManager {
	/**
	 * Adds a new buffer to the internal buffer collection.
	 *
	 * @param buffer - The buffer to add to the manager
	 * @throws {BufferOperationError} If buffer addition fails
	 *
	 * @remarks
	 * This method should handle buffer validation and memory management
	 */
	addBuffer(buffer: Buffer): void;

	/**
	 * Returns the total length of all managed buffers.
	 *
	 * @returns The combined length of all buffers in bytes
	 *
	 * @remarks
	 * This method should efficiently track total length without iterating buffers
	 */
	getTotalLength(): number;

	/**
	 * Creates fixed-size chunks from the managed buffers.
	 *
	 * @param size - The size of each chunk in bytes
	 * @returns Array of buffer chunks of the specified size
	 * @throws {BufferOperationError} If chunk creation fails
	 *
	 * @remarks
	 * - Should handle partial chunks efficiently
	 * - Must maintain data order
	 * - Should update internal state after chunk creation
	 */
	getChunks(size: number): Buffer[];

	/**
	 * Clears all managed buffers and resets the internal state.
	 *
	 * @remarks
	 * - Should properly handle memory cleanup
	 * - Should reset all internal counters and state
	 */
	clear(): void;

	/**
	 * Retrieves any remaining data that doesn't form a complete chunk.
	 *
	 * @returns Buffer containing remaining data, or null if empty
	 * @throws {BufferOperationError} If operation fails
	 *
	 * @remarks
	 * - Should handle memory efficiently for remaining data
	 * - Must maintain data integrity
	 */
	getRemainingData(): Buffer | null;
}

/**
 * Defines the interface for managing stream state transitions and queries.
 * Provides a clean API for state management and state checking operations.
 *
 * @interface StreamStateManager
 * @category State Management
 *
 * @example
 * ```typescript
 * class CustomStateManager implements StreamStateManager {
 *   private state = {
 *     paused: false,
 *     ended: false,
 *     endEmitted: false,
 *     emitting: false,
 *     needDrain: false
 *   };
 *
 *   isPaused(): boolean {
 *     return this.state.paused;
 *   }
 *
 *   // Additional method implementations...
 * }
 * ```
 */
export interface StreamStateManager {
	/**
	 * Returns true if the stream is currently paused.
	 */
	isPaused(): boolean;

	/**
	 * Returns true if the stream is actively emitting data.
	 */
	isEmitting(): boolean;

	/**
	 * Returns true if the stream has been ended.
	 */
	isEnded(): boolean;

	/**
	 * Returns true if the end event has been emitted.
	 */
	isEndEmitted(): boolean;

	/**
	 * Returns true if the stream needs to emit a drain event.
	 */
	needsDrain(): boolean;

	/**
	 * Updates the paused state of the stream.
	 * @param value - New paused state
	 */
	setPaused(value: boolean): void;

	/**
	 * Updates the emitting state of the stream.
	 * @param value - New emitting state
	 */
	setEmitting(value: boolean): void;

	/**
	 * Updates the ended state of the stream.
	 * @param value - New ended state
	 */
	setEnded(value: boolean): void;

	/**
	 * Updates the endEmitted state of the stream.
	 * @param value - New endEmitted state
	 */
	setEndEmitted(value: boolean): void;

	/**
	 * Updates the needDrain state of the stream.
	 * @param value - New needDrain state
	 */
	setNeedDrain(value: boolean): void;
}

/**
 * Defines the events that can be emitted by StreamBlockify.
 * Provides type safety for event handling.
 *
 * @interface StreamEvents
 * @category Events
 *
 * @example
 * ```typescript
 * stream.on('data', (chunk: Buffer) => {
 *   console.log(`Received chunk of size: ${chunk.length}`);
 * });
 *
 * stream.on('end', () => {
 *   console.log('Stream has ended');
 * });
 * ```
 */
export interface StreamEvents {
	/**
	 * Emitted when a data chunk is ready.
	 * The chunk will be a Buffer of the configured size.
	 */
	data: Buffer;

	/**
	 * Emitted when the stream has ended and all data has been processed.
	 */
	end: void;

	/**
	 * Emitted when an error occurs during stream processing.
	 */
	error: Error;

	/**
	 * Emitted when the internal buffer has been drained.
	 */
	drain: void;
}

/**
 * Type helper for stream event handlers with proper typing.
 *
 * @typeParam T - The type of data passed to the event handler
 * @category Types
 */
export type StreamEventHandler<T> = T extends void ? () => void : (data: T) => void;

/**
 * Interface for stream event emission with type safety.
 *
 * @interface StreamEventEmitter
 * @category Events
 */
export interface StreamEventEmitter {
	/**
	 * Registers an event listener for the specified event.
	 *
	 * @typeParam K - The event key from StreamEvents
	 * @param event - The event to listen for
	 * @param listener - The callback to execute when the event occurs
	 */
	on<K extends keyof StreamEvents>(event: K, listener: StreamEventHandler<StreamEvents[K]>): void;

	/**
	 * Emits an event with the specified data.
	 *
	 * @typeParam K - The event key from StreamEvents
	 * @param event - The event to emit
	 * @param args - The data to pass to event handlers
	 */
	emit<K extends keyof StreamEvents>(event: K, ...args: StreamEvents[K] extends void ? [] : [StreamEvents[K]]): void;
}
