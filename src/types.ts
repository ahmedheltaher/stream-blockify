import { TransformOptions } from 'node:stream';

/**
 * Options for configuring the StreamBlockify transform stream.
 * @public
 */
export interface BlockifyOptions extends TransformOptions {
	/**
	 * Size of each block in bytes.
	 * Must be a positive integer.
	 * @required
	 */
	blockSize: number;

	/**
	 * Whether to emit partial blocks at the end of the stream.
	 * When false, the last block will be padded to the full block size.
	 * @default true
	 */
	emitPartial?: boolean;

	/**
	 * Padding byte or Buffer to use when padding the last block.
	 * Only used when emitPartial is false.
	 * @default 0
	 */
	padding?: number | Buffer;

	/**
	 * Whether to allocate buffer as zeroed-out.
	 * Safer but slower than uninitialized allocation.
	 * @default false
	 */
	safeAllocation?: boolean;

	/**
	 * Function to call when a complete block is emitted.
	 * Called before pushing the block to the stream.
	 */
	onBlock?: (block: Buffer) => void;

	/**
	 * Transform function to apply to each block before emitting.
	 * The returned buffer will be pushed to the stream.
	 */
	blockTransform?: (block: Buffer) => Buffer;
}
