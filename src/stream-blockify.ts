import { Transform, TransformCallback } from 'node:stream';
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
 *   maxBufferedBlocks: 10,
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
	 * The maximum number of blocks to buffer before applying backpressure.
	 * If set to 0, there is no limit on the number of buffered blocks.
	 * @private
	 * @default 0
	 */
	private readonly _maximumBufferedBlocks: number;

	/**
	 * A function to transform each block before emitting it.
	 * @private
	 */
	private readonly _blockTransform?: (block: Buffer) => Buffer;

	/**
	 * The current number of buffered blocks.
	 * @private
	 */
	private _bufferedBlocksCount = 0;

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
		this._maximumBufferedBlocks = options.maximumBufferedBlocks || 0;
		this._blockTransform = options.blockTransform;

		// Allocate buffer - either safely (zeroed) or unsafely (faster)
		this._buffer = options.safeAllocation ? Buffer.alloc(this._blockSize) : Buffer.allocUnsafe(this._blockSize);
		this._position = 0;
	}

	/**
	 * Resets the internal state of the stream.
	 * This method sets the position to the beginning and clears the count of buffered blocks.
	 * @public
	 */
	public reset(): void {
		this._position = 0;
		this._bufferedBlocksCount = 0;
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
	 * Retrieves the count of buffered blocks.
	 * @returns The number of buffered blocks.
	 * @public
	 */
	public getBufferedBlocksCount(): number {
		return this._bufferedBlocksCount;
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
			let offset = 0;

			while (offset < buffer.length) {
				if (this._maximumBufferedBlocks > 0 && this._bufferedBlocksCount >= this._maximumBufferedBlocks) {
					const remainingChunk = buffer.subarray(offset);
					this.once('drain', () => {
						this._transform(remainingChunk, encoding, callback);
					});
					return;
				}

				const bytesToCopy = Math.min(this._blockSize - this._position, buffer.length - offset);
				buffer.copy(this._buffer, this._position, offset, offset + bytesToCopy);

				this._position += bytesToCopy;
				offset += bytesToCopy;

				if (this._position === this._blockSize) {
					const canContinue = this._emitBlock(this._buffer);

					this._position = 0;

					if (!canContinue && this._maximumBufferedBlocks > 0 && offset < buffer.length) {
						const remainingChunk = buffer.subarray(offset);
						this.once('drain', () => {
							this._transform(remainingChunk, encoding, callback);
						});
						return;
					}
				}
			}

			callback();
		} catch (error) {
			callback(error instanceof Error ? error : new Error(String(error)));
		}
	}

	/**
	 * Flushes the remaining data in the buffer when the stream is ending.
	 * @param callback - A callback function to be called after the flush operation is complete.
	 * @internal
	 */
	_flush(callback: TransformCallback): void {
		try {
			if (this._position > 0) {
				if (this._emitPartial) {
					this._emitBlock(this._buffer.subarray(0, this._position));
				} else {
					this._applyPadding();
					this._emitBlock(this._buffer);
				}
			}

			process.nextTick(callback);
		} catch (error) {
			callback(error instanceof Error ? error : new Error(String(error)));
		}
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
		if (Buffer.isBuffer(this._padding)) {
			let paddingOffset = 0;
			for (let i = this._position; i < this._blockSize; i++) {
				this._buffer[i] = this._padding[paddingOffset];
				paddingOffset = (paddingOffset + 1) % this._padding.length;
			}
		} else {
			this._buffer.fill(this._padding, this._position, this._blockSize);
		}
	}

	/**
	 * Emits a block of data to the stream.
	 * @param block - The buffer containing the block of data to emit.
	 * @returns Whether the stream can consume more data.
	 * @private
	 */
	private _emitBlock(block: Buffer): boolean {
		try {
			const outputBlock = Buffer.from(block);

			const finalBlock = this._blockTransform ? this._blockTransform(outputBlock) : outputBlock;

			if (this._onBlock) {
				this._onBlock(finalBlock);
			}

			this._bufferedBlocksCount++;

			const canContinue = this.push(finalBlock);

			if (!canContinue && this._maximumBufferedBlocks > 0) {
				process.nextTick(() => {
					this._bufferedBlocksCount--;
					this.emit('drain');
				});
			} else {
				this._bufferedBlocksCount--;
			}

			return canContinue;
		} catch (error) {
			this.emit('error', error instanceof Error ? error : new Error(String(error)));
			return false;
		}
	}
}
