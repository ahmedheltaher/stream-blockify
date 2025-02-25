import { Writable, WritableOptions } from 'stream';

/**
 * A simple /dev/null style writable stream that counts bytes but discards data.
 */
export class DevNullStream extends Writable {
	private _bytesWritten: number = 0;

	/**
	 * Creates an instance of DevNullStream.
	 * @param options Optional writable stream options.
	 */
	constructor(options?: WritableOptions) {
		super(options);
	}

	/**
	 * Implements the writable stream _write method.
	 * @param chunk The chunk of data to write.
	 * @param _encoding The encoding of the chunk.
	 * @param callback The callback function to call when the write is complete.
	 */
	_write(chunk: Buffer, _encoding: string, callback: (error?: Error | null) => void): void {
		this._bytesWritten += chunk.length;
		callback();
	}

	/**
	 * Returns the number of bytes written to the stream.
	 * @returns The number of bytes written.
	 */
	getBytesWritten(): number {
		return this._bytesWritten;
	}
}
