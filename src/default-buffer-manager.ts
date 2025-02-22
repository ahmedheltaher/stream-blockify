import { BufferManager } from './types';

export class DefaultBufferManager implements BufferManager {
	private buffers: Buffer[] = [];
	private totalLength = 0;
	private offset = 0;

	public addBuffer(buffer: Buffer): void {
		this.buffers.push(buffer);
		this.totalLength += buffer.length;
	}

	public getTotalLength(): number {
		return this.totalLength;
	}

	public getChunks(size: number): Buffer[] {
		if (size <= 0 || this.totalLength === 0) return [];

		const chunks: Buffer[] = [];
		while (this.totalLength >= size) {
			const chunk = this.createChunk(size);
			if (!chunk) break;
			chunks.push(chunk);
		}

		return chunks;
	}

	public clear(): void {
		this.buffers = [];
		this.totalLength = 0;
		this.offset = 0;
	}

	public getRemainingData(): Buffer | null {
		if (this.totalLength === 0) return null;
		if (this.buffers.length === 1) {
			return this.offset ? this.buffers[0].subarray(this.offset) : this.buffers[0];
		}

		const outBuffer = Buffer.alloc(this.totalLength);
		let outputOffset = 0;

		for (const buffer of this.buffers) {
			const start = buffer === this.buffers[0] ? this.offset : 0;
			const length = buffer.length - start;
			buffer.copy(outBuffer, outputOffset, start);
			outputOffset += length;
		}

		return outBuffer;
	}

	private createChunk(size: number): Buffer | null {
		if (this.totalLength < size) return null;

		const chunk = Buffer.alloc(size);
		let chunkOffset = 0;
		let remainingSize = size;

		while (remainingSize > 0 && this.buffers.length > 0) {
			const currentBuffer = this.buffers[0];
			const availableLength = currentBuffer.length - this.offset;
			const copyLength = Math.min(availableLength, remainingSize);

			currentBuffer.copy(chunk, chunkOffset, this.offset, this.offset + copyLength);
			this.offset += copyLength;
			chunkOffset += copyLength;
			remainingSize -= copyLength;

			if (this.offset >= currentBuffer.length) {
				this.buffers.shift();
				this.offset = 0;
			}
		}

		this.totalLength -= size;
		return chunk;
	}
}
