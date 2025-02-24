import { EventEmitter } from 'events';
import { StreamBlockify } from '../../src';

interface VideoFrame {
	timestamp: number;
	data: Buffer;
	type: 'keyframe' | 'frame';
}

export class VideoChunkProcessor extends EventEmitter {
	private readonly blockifier: StreamBlockify;
	private frameBuffer: Buffer[] = [];
	private readonly FRAME_MARKER = Buffer.from([0x00, 0x00, 0x01]); // H.264 NAL unit marker
	private frameCount = 0;

	constructor(chunkSize: number = 64 * 1024) {
		// 64KB chunks by default
		super();
		this.blockifier = new StreamBlockify({ size: chunkSize });
		this.setupEventHandlers();
	}

	private setupEventHandlers(): void {
		this.blockifier.on('data', this.processVideoChunk.bind(this));
		this.blockifier.on('end', this.processFinalFrame.bind(this));
		this.blockifier.on('error', this.handleError.bind(this));
	}

	private processVideoChunk(chunk: Buffer): void {
		this.frameBuffer.push(chunk);
		this.tryProcessFrames();
	}

	private tryProcessFrames(): void {
		const combinedData = Buffer.concat(this.frameBuffer);
		let lastMarkerIndex = 0;
		let markerIndex = this.findNextFrameMarker(combinedData, lastMarkerIndex);

		while (markerIndex !== -1) {
			if (lastMarkerIndex < markerIndex) {
				// Extract frame data between markers
				const frameData = combinedData.subarray(lastMarkerIndex, markerIndex);
				this.processFrame(frameData);
			}

			// Move past this marker for next search
			lastMarkerIndex = markerIndex + this.FRAME_MARKER.length;
			markerIndex = this.findNextFrameMarker(combinedData, lastMarkerIndex);
		}

		// Keep the unprocessed remainder in the buffer
		this.frameBuffer = [combinedData.subarray(lastMarkerIndex)];
	}

	private findNextFrameMarker(data: Buffer, startIndex: number): number {
		return data.indexOf(this.FRAME_MARKER, startIndex);
	}

	private processFrame(frameData: Buffer): void {
		if (frameData.length < 4) return; // Skip invalid frames

		const frameType = frameData[0] & 0x1f;
		const timestamp = Date.now();
		const frame: VideoFrame = {
			timestamp,
			data: frameData,
			type: frameType === 5 ? 'keyframe' : 'frame'
		};

		this.frameCount++;
		this.emit('frame', frame);
		// eslint-disable-next-line no-console
		console.log(
			`Processed ${frame.type} [${this.frameCount}] ` +
				`Size: ${frameData.length} bytes, ` +
				`Timestamp: ${timestamp}`
		);
	}

	private processFinalFrame(): void {
		if (this.frameBuffer.length > 0) {
			const finalData = Buffer.concat(this.frameBuffer);
			if (finalData.length > 0) {
				this.processFrame(finalData);
			}
		}
		this.emit('end');
		// eslint-disable-next-line no-console
		console.log(`Video processing completed. Total frames: ${this.frameCount}`);
	}

	private handleError(error: Error): void {
		this.emit('error', error);
		// eslint-disable-next-line no-console
		console.error('Video processing error:', error);
	}

	/**
	 * Process a chunk of video data
	 * @param data Video data buffer
	 * @returns true if more data can be written, false if backpressure is applied
	 */
	public processVideoData(data: Buffer): boolean {
		return this.blockifier.write(data);
	}

	/**
	 * End video processing
	 */
	public end(): void {
		this.blockifier.end();
	}
}

// Example usage
if (require.main === module) {
	const processor = new VideoChunkProcessor();

	// Handle frame events
	processor.on('frame', (frame: VideoFrame) => {
		// eslint-disable-next-line no-console
		console.log(`Received ${frame.type} of ${frame.data.length} bytes at timestamp ${frame.timestamp}`);
	});

	// Simulate video stream data
	const simulateVideoStream = () => {
		// Create a mock video frame with NAL unit marker
		const createMockFrame = (isKeyframe: boolean) => {
			const header = Buffer.from([0x00, 0x00, 0x01]);
			const frameType = Buffer.from([isKeyframe ? 0x05 : 0x01]);
			const payload = Buffer.alloc(1024).fill(0xff);
			return Buffer.concat([header, frameType, payload]);
		};

		// Send some mock frames
		for (let i = 0; i < 5; i++) {
			const isKeyframe = i === 0;
			const frame = createMockFrame(isKeyframe);
			processor.processVideoData(frame);
		}

		processor.end();
	};

	simulateVideoStream();
}
