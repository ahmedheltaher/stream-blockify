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

	public getChunks(chunkSize: number): Buffer[] {
		const chunks: Buffer[] = [];
		let currentOffset = 0;

		while (this.totalLength - currentOffset >= chunkSize) {
			const chunk = this.createChunk(chunkSize);
			if (!chunk) break;
			chunks.push(chunk);
			currentOffset += chunkSize;
		}

		this.updateBuffersAfterChunking(currentOffset);
		return chunks;
	}

	public clear(): void {
		this.buffers = [];
		this.totalLength = 0;
		this.offset = 0;
	}

	public getRemainingData(): Buffer | null {
		if (this.buffers.length === 0) return null;
		if (this.buffers.length === 1) {
			return this.offset ? this.buffers[0].subarray(this.offset) : this.buffers[0];
		}

		const outBuffer = Buffer.alloc(this.totalLength);
		let outputOffset = 0;

		for (const buffer of this.buffers) {
			const length = buffer.length - this.offset;
			buffer.copy(outBuffer, outputOffset, this.offset);
			outputOffset += length;
			this.offset = 0;
		}

		return outBuffer;
	}

	private createChunk(size: number): Buffer | null {
		let chunk: Buffer | undefined;
		let chunkOffset = 0;
		let remainingSize = size;
		let bufferIndex = 0;

		while (remainingSize > 0 && bufferIndex < this.buffers.length) {
			const currentBuffer = this.buffers[bufferIndex];
			const availableLength = currentBuffer.length - this.offset;
			const copyLength = Math.min(availableLength, remainingSize);

			if (!chunk) {
				if (currentBuffer.length === size && this.offset === 0) {
					return currentBuffer;
				}
				chunk = Buffer.alloc(size);
			}

			currentBuffer.copy(chunk, chunkOffset, this.offset, this.offset + copyLength);

			if (availableLength > remainingSize) {
				this.offset += remainingSize;
				break;
			}

			chunkOffset += copyLength;
			remainingSize -= copyLength;
			bufferIndex++;
			this.offset = 0;
		}

		return chunk ?? null;
	}

	private updateBuffersAfterChunking(processedLength: number): void {
		let remainingLength = processedLength;
		while (remainingLength > 0 && this.buffers.length > 0) {
			const currentBuffer = this.buffers[0];
			const bufferLength = currentBuffer.length - this.offset;

			if (bufferLength > remainingLength) {
				this.offset += remainingLength;
				break;
			}

			remainingLength -= bufferLength;
			this.totalLength -= bufferLength;
			this.buffers.shift();
			this.offset = 0;
		}
	}
}
