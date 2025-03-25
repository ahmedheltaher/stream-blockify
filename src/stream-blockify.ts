import { Transform, TransformCallback } from 'node:stream';
import { getLogger } from './debug';
import { BlockifyError } from './errors';
import { BlockifyOptions } from './types';

/**
 * A Transform stream that processes input data in fixed-size blocks.
 *
 * The StreamBlockify class extends the Transform stream and processes incoming data in fixed-size blocks.
 * It provides options for handling partial blocks, padding, and custom block transformations.
 *
 * @example
 * ```typescript
 * import { StreamBlockify } from 'stream-blockify';
 *
 * const blockify = new StreamBlockify({
 *   blockSize: 1024,
 *   emitPartial: true,
 *   padding: 0,
 *   onBlock: (block) => {
 *     console.log('New block:', block);
 *   },
 *   blockTransform: (block) => {
 *     // Custom transformation logic
 *     return block;
 *   }
 * });
 *
 * inputStream.pipe(blockify).pipe(outputStream);
 * ```
 *
 * @public
 */
export class StreamBlockify extends Transform {
	/**
	 * Logger instance for this class
	 * @private
	 */
	private readonly logger = getLogger('StreamBlockify');

	/**
	 * The internal buffer used for block allocation.
	 * @private
	 */
	private _buffer: Buffer;

	/**
	 * The current position in the buffer.
	 * @private
	 */
	private _position = 0;

	/**
	 * The size of each block in bytes.
	 * @private
	 */
	private readonly _blockSize: number;

	/**
	 * Whether to emit partial blocks when the stream ends.
	 * If set to false, the last block will be padded with the specified padding value.
	 * @private
	 * @default true
	 */
	private readonly _emitPartial: boolean;

	/**
	 * The padding to use for incomplete blocks.
	 * If padding is a number, it will be used to fill the remaining bytes of the block.
	 * If padding is a Buffer, its content will be used to fill the remaining bytes.
	 * If emitPartial is true, this value is ignored.
	 * @private
	 * @default 0
	 */
	private readonly _padding: number | Buffer;

	/**
	 * A callback function to be called with each emitted block.
	 * @private
	 */
	private readonly _onBlock?: (block: Buffer) => void;

	/**
	 * A function to transform each block before emitting it.
	 * @private
	 */
	private readonly _blockTransform?: (block: Buffer) => Buffer;

	/**
	 * Constructs a new instance of the StreamBlockify class.
	 *
	 * @param options - The configuration options for the StreamBlockify instance.
	 * @throws Error if the blockSize is not a positive integer.
	 * @public
	 */
	constructor(options: BlockifyOptions) {
		if (!options.blockSize || options.blockSize <= 0 || !Number.isInteger(options.blockSize)) {
			throw new BlockifyError('blockSize must be a positive integer');
		}

		const transformOptions = {
			...options,
			highWaterMark: options.highWaterMark || options.blockSize * 8
		};

		super(transformOptions);

		this._blockSize = options.blockSize;
		this._emitPartial = options.emitPartial !== false;
		this._padding = options.padding !== undefined ? options.padding : 0;
		this._onBlock = options.onBlock;
		this._blockTransform = options.blockTransform;

		// Allocate buffer - either safely (zeroed) or unsafely (faster)
		this._buffer = options.safeAllocation ? Buffer.alloc(this._blockSize) : Buffer.allocUnsafe(this._blockSize);
		this._position = 0;

		this.logger.info(
			'StreamBlockify initialized with blockSize: %d, emitPartial: %s',
			this._blockSize,
			this._emitPartial
		);
		this.logger.debug('Using %s buffer allocation', options.safeAllocation ? 'safe' : 'unsafe');
	}

	/**
	 * Resets the internal state of the stream.
	 * This method sets the position to the beginning.
	 * @public
	 */
	public reset(): void {
		this.logger.debug('Resetting stream state');
		this._position = 0;
	}

	/**
	 * Retrieves the current position.
	 * @returns The current position.
	 * @public
	 */
	public getPosition(): number {
		return this._position;
	}

	/**
	 * Transforms the input chunk by buffering it and emitting blocks of a specified size.
	 * @param chunk - The input data chunk, which can be a Buffer or a string.
	 * @param encoding - The encoding of the chunk if it is a string.
	 * @param callback - A callback function to be called when the transformation is complete or an error occurs.
	 * @internal
	 */
	_transform(chunk: Buffer | string, encoding: BufferEncoding, callback: TransformCallback): void {
		try {
			const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
			this.logger.debug('Processing chunk of size %d bytes', buffer.length);
			this._processChunk(buffer);
			this.logger.trace('Finished processing chunk, position: %d/%d', this._position, this._blockSize);
			callback();
		} catch (error) {
			this.logger.error('Error in _transform: %O', error);
			callback(error instanceof Error ? error : new Error(String(error)));
		}
	}

	/**
	 * Processes the input buffer and emits blocks as needed.
	 * @param buffer - The input buffer to process.
	 * @private
	 */
	private _processChunk(buffer: Buffer): void {
		let offset = 0;

		while (offset < buffer.length) {
			const bytesToCopy = Math.min(this._blockSize - this._position, buffer.length - offset);
			buffer.copy(this._buffer, this._position, offset, offset + bytesToCopy);

			this._position += bytesToCopy;
			offset += bytesToCopy;

			this.logger.trace('Copied %d bytes, position: %d/%d', bytesToCopy, this._position, this._blockSize);

			if (this._position === this._blockSize) {
				this.logger.debug('Block filled completely, emitting block of size %d', this._blockSize);
				this._emitBlock(this._buffer);
				this._position = 0;
			}
		}
	}

	/**
	 * Flushes the remaining data in the buffer when the stream is ending.
	 * @param callback - A callback function to be called after the flush operation is complete.
	 * @internal
	 */
	_flush(callback: TransformCallback): void {
		try {
			if (this._position <= 0) {
				this.logger.debug('No remaining data to flush');
			} else if (this._emitPartial) {
				this._emitPartialBlock();
			} else {
				this._emitPaddedBlock();
			}
			process.nextTick(callback);
		} catch (error) {
			this._handleFlushError(error, callback);
		}
	}

	/**
	 * Emits a partial block if there is remaining data in the buffer.
	 * @private
	 */
	private _emitPartialBlock(): void {
		this.logger.info('Emitting partial block of size %d', this._position);
		this._emitBlock(this._buffer.subarray(0, this._position));
	}

	/**
	 * Pads and emits the final block if there is remaining data in the buffer.
	 * @private
	 */
	private _emitPaddedBlock(): void {
		this.logger.info('Padding final block from position %d to size %d', this._position, this._blockSize);
		this._applyPadding();
		this._emitBlock(this._buffer);
	}

	/**
	 * Handles errors that occur during the flush operation.
	 * @param error - The error to handle.
	 * @param callback - The callback to invoke with the error.
	 * @private
	 */
	private _handleFlushError(error: unknown, callback: TransformCallback): void {
		this.logger.error('Error in _flush: %O', error);
		callback(error instanceof Error ? error : new Error(String(error)));
	}

	/**
	 * Applies padding to the internal buffer.
	 *
	 * If the padding is a Buffer, it will be applied in a cyclic manner starting from the current position
	 * up to the block size. If the padding is not a Buffer, it will fill the buffer from the current position
	 * to the block size with the padding value.
	 *
	 * @private
	 */
	private _applyPadding(): void {
		const padLength = this._blockSize - this._position;

		if (Buffer.isBuffer(this._padding)) {
			this.logger.debug('Applying buffer padding of length %d, using cyclic pattern', padLength);
			let paddingOffset = 0;
			for (let i = this._position; i < this._blockSize; i++) {
				this._buffer[i] = this._padding[paddingOffset];
				paddingOffset = (paddingOffset + 1) % this._padding.length;
			}
			return;
		}
		this.logger.debug('Applying numeric padding with value %d for %d bytes', this._padding, padLength);
		this._buffer.fill(this._padding, this._position, this._blockSize);
	}

	/**
	 * Emits a block of data to the stream.
	 * @param block - The buffer containing the block of data to emit.
	 * @private
	 */
	private _emitBlock(block: Buffer): void {
		try {
			const transformedBlock = this._blockTransform ? this._applyBlockTransform(block) : Buffer.from(block);
			this._onBlock?.(transformedBlock);
			this.push(transformedBlock);
		} catch (error) {
			this._handleEmitBlockError(error);
		}
	}

	/**
	 * Applies the block transformation function to the given block.
	 * @param block - The buffer containing the block of data to transform.
	 * @returns The transformed block.
	 * @private
	 */
	private _applyBlockTransform(block: Buffer): Buffer {
		this.logger.debug('Applying block transformation');
		const transformedBlock = this._blockTransform!(Buffer.from(block));
		this.logger.trace('Block size after transformation: %d', transformedBlock.length);
		return transformedBlock;
	}

	/**
	 * Handles errors that occur during block emission.
	 * @param error - The error to handle.
	 * @private
	 */
	private _handleEmitBlockError(error: unknown): void {
		this.logger.error('Error in _emitBlock: %O', error);
		this.emit('error', error instanceof Error ? error : new Error(String(error)));
	}
}
