import { StreamBlockify } from '../../src';

/**
 * Example protocol frame structure:
 * - Header (4 bytes): Message type and length
 * - Payload (variable length): Actual message content
 * - Checksum (4 bytes): For data validation
 */
export class ProtocolFrameProcessor {
	private readonly blockifier: StreamBlockify;
	private readonly frameSize: number;

	constructor(frameSize: number = 512) {
		this.frameSize = frameSize;
		this.blockifier = new StreamBlockify({ size: frameSize });
		this.setupEventHandlers();
	}

	private setupEventHandlers(): void {
		this.blockifier.on('data', this.processFrame.bind(this));
		this.blockifier.on('error', this.handleError.bind(this));
		// eslint-disable-next-line no-console
		this.blockifier.on('end', () => console.log('Frame processing completed'));
	}

	private processFrame(frame: Buffer): void {
		try {
			// eslint-disable-next-line no-console
			console.log(`Processing frame with ${frame.length} bytes`);
			// Extract frame components
			const header = frame.readUInt32BE(0);
			const messageType = header >>> 24;
			const payloadLength = header & 0x00_ff_ff_ff;

			const payload = frame.subarray(4, 4 + payloadLength);
			const checksum = frame.readUInt32BE(frame.length - 4);

			// Validate checksum
			if (this.validateChecksum(payload, checksum)) {
				this.handleMessage(messageType, payload);
			} else {
				// eslint-disable-next-line no-console
				console.error('Invalid checksum detected');
			}
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('Error processing frame:', err);
		}
	}

	private validateChecksum(payload: Buffer, receivedChecksum: number): boolean {
		// Simple checksum calculation for demonstration
		const calculatedChecksum = payload.reduce((sum, byte) => sum + byte, 0) >>> 0;
		return calculatedChecksum === receivedChecksum;
	}

	private handleMessage(type: number, payload: Buffer): void {
		// eslint-disable-next-line no-console
		console.log(`Processing message type ${type} with ${payload.length} bytes`);
		// Add your message handling logic here
	}

	private handleError(error: unknown): void {
		// eslint-disable-next-line no-console
		console.error('Protocol processing error:', error);
	}

	/**
	 * Process incoming network data
	 * @param data Raw network data
	 * @returns true if more data can be written, false if backpressure is applied
	 */
	public processData(data: Buffer): boolean {
		try {
			return this.blockifier.write(data);
		} catch (error) {
			this.handleError(error);
			return false;
		}
	}

	/**
	 * End the processing stream
	 */
	public end(): void {
		this.blockifier.end();
	}
}

// Example usage

function createProtocolMessage(type: number, payload: Buffer): Buffer {
	const header = Buffer.alloc(4);
	header.writeUInt32BE((type << 24) | payload.length);

	const checksum = Buffer.alloc(4);
	checksum.writeUInt32BE(payload.reduce((sum, byte) => sum + byte, 0) >>> 0);

	return Buffer.concat([header, payload, checksum]);
}

if (require.main === module) {
	const processor = new ProtocolFrameProcessor(512);

	// Create a sample protocol message
	const message = createProtocolMessage(3, Buffer.from('Hello, world!'));

	processor.processData(message);
	processor.end();
}
