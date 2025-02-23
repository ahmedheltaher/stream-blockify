import { WriteAfterEndError } from '../src/errors';
import { StreamBlockify } from '../src/stream-blockify';
import { BufferManager, StreamStateManager } from '../src/types';

describe('StreamBlockify', () => {
	let streamBlockify: StreamBlockify;
	let mockBufferManager: jest.Mocked<BufferManager>;
	let mockStateManager: jest.Mocked<StreamStateManager>;
	let dataEvents: Buffer[];
	let errorEvents: Error[];
	let drainEvents: number;
	let endEvents: number;

	beforeEach(() => {
		dataEvents = [];
		errorEvents = [];
		drainEvents = 0;
		endEvents = 0;

		mockBufferManager = {
			addBuffer: jest.fn(),
			getTotalLength: jest.fn().mockReturnValue(0),
			getChunks: jest.fn().mockReturnValue([]),
			clear: jest.fn(),
			getRemainingData: jest.fn().mockReturnValue(null)
		};

		mockStateManager = {
			isPaused: jest.fn().mockReturnValue(false),
			isEmitting: jest.fn().mockReturnValue(false),
			isEnded: jest.fn().mockReturnValue(false),
			isEndEmitted: jest.fn().mockReturnValue(false),
			needsDrain: jest.fn().mockReturnValue(false),
			setPaused: jest.fn(),
			setEmitting: jest.fn(),
			setEnded: jest.fn(),
			setEndEmitted: jest.fn(),
			setNeedDrain: jest.fn()
		};

		streamBlockify = new StreamBlockify({ size: 10 }, mockBufferManager, mockStateManager);

		streamBlockify.on('data', chunk => dataEvents.push(chunk));
		streamBlockify.on('error', err => errorEvents.push(err));
		streamBlockify.on('drain', () => drainEvents++);
		streamBlockify.on('end', () => endEvents++);
	});

	describe('constructor', () => {
		it('should initialize with default values when no config provided', () => {
			const defaultStream = new StreamBlockify();
			expect(defaultStream['chunkSize']).toBe(512);
		});

		it('should initialize with custom size', () => {
			const customStream = new StreamBlockify({ size: 1024 });
			expect(customStream['chunkSize']).toBe(1024);
		});
	});

	describe('write', () => {
		it('should add buffer when writing string data', () => {
			streamBlockify.write('test');
			expect(mockBufferManager.addBuffer).toHaveBeenCalledWith(Buffer.from('test'));
		});

		it('should add buffer when writing Buffer data', () => {
			const buffer = Buffer.from('test');
			streamBlockify.write(buffer);
			expect(mockBufferManager.addBuffer).toHaveBeenCalledWith(buffer);
		});

		it('should not emit chunks when buffer length is less than chunk size', () => {
			mockBufferManager.getTotalLength.mockReturnValue(5); // Less than chunk size (10)
			streamBlockify.write('test');
			expect(mockBufferManager.getChunks).not.toHaveBeenCalled();
		});

		it('should emit chunks when buffer reaches chunk size', () => {
			mockBufferManager.getTotalLength.mockReturnValue(10);
			mockBufferManager.getChunks.mockReturnValue([Buffer.from('full chunk')]);

			streamBlockify.write('enough data');

			expect(mockBufferManager.getChunks).toHaveBeenCalledWith(10);
			expect(dataEvents.length).toBe(1);
			expect(dataEvents[0].toString()).toBe('full chunk');
		});

		it('should return false and set needDrain when paused', () => {
			mockBufferManager.getTotalLength.mockReturnValue(10);
			mockStateManager.isPaused.mockReturnValue(true);

			const result = streamBlockify.write('test');

			expect(result).toBe(false);
			expect(mockStateManager.setNeedDrain).toHaveBeenCalledWith(true);
			expect(mockBufferManager.getChunks).not.toHaveBeenCalled();
		});

		it('should throw WriteAfterEndError when writing after end', () => {
			mockStateManager.isEnded.mockReturnValue(true);

			expect(() => {
				streamBlockify.write('test');
			}).toThrow(WriteAfterEndError);
		});
	});

	describe('pause/resume', () => {
		it('should set paused state to true when paused', () => {
			streamBlockify.pause();
			expect(mockStateManager.setPaused).toHaveBeenCalledWith(true);
		});

		it('should set paused state to false and emit chunks when resumed', () => {
			mockBufferManager.getTotalLength.mockReturnValue(10);
			mockBufferManager.getChunks.mockReturnValue([Buffer.from('full chunk')]);

			streamBlockify.resume();

			expect(mockStateManager.setPaused).toHaveBeenCalledWith(false);
			expect(mockBufferManager.getChunks).toHaveBeenCalled();
			expect(dataEvents.length).toBe(1);
		});
	});

	describe('end', () => {
		it('should write final chunk if provided', () => {
			streamBlockify.end('final data');

			expect(mockBufferManager.addBuffer).toHaveBeenCalledWith(Buffer.from('final data'));
			expect(mockStateManager.setEnded).toHaveBeenCalledWith(true);
		});

		it('should set ended state and emit end event when buffer is empty', () => {
			mockBufferManager.getTotalLength.mockReturnValue(0);
			mockStateManager.isEnded.mockReturnValue(true);
			mockStateManager.isEndEmitted.mockReturnValue(false);

			streamBlockify.end();

			expect(mockStateManager.setEnded).toHaveBeenCalledWith(true);
			expect(mockStateManager.setEndEmitted).toHaveBeenCalledWith(true);
			expect(endEvents).toBe(1);
		});

		it('should flush remaining data', () => {
			const remainingData = Buffer.from('remaining');
			mockBufferManager.getRemainingData.mockReturnValue(remainingData);
			mockStateManager.isEnded.mockReturnValue(true);
			mockStateManager.isEndEmitted.mockReturnValue(false);

			streamBlockify.end();

			expect(dataEvents).toContain(remainingData);
			expect(mockBufferManager.clear).toHaveBeenCalled();
		});
	});

	describe('error handling', () => {
		it('should emit error when exception occurs during chunk emission', () => {
			mockBufferManager.getTotalLength.mockReturnValue(10);
			mockBufferManager.getChunks.mockImplementation(() => {
				throw new Error('Test error');
			});

			streamBlockify.write('test');

			expect(errorEvents.length).toBe(1);
			expect(errorEvents[0].message).toBe(
				"Buffer operation 'emitChunks' failed: Buffer operation 'emitFullChunks' failed: Test error"
			);
			expect(mockStateManager.setEmitting).toHaveBeenCalledWith(false);
		});
	});

	describe('drain events', () => {
		it('should emit drain event when needed', () => {
			mockStateManager.needsDrain.mockReturnValue(true);
			mockBufferManager.getTotalLength.mockReturnValue(10);

			streamBlockify.write('test');

			expect(drainEvents).toBe(1);
			expect(mockStateManager.setNeedDrain).toHaveBeenCalledWith(false);
		});
	});

	describe('_emitChunks', () => {
		it('should not emit when already emitting', () => {
			mockStateManager.isEmitting.mockReturnValue(true);
			mockBufferManager.getTotalLength.mockReturnValue(10);

			streamBlockify.write('test');

			expect(mockBufferManager.getChunks).not.toHaveBeenCalled();
		});

		it('should not emit when paused', () => {
			mockStateManager.isPaused.mockReturnValue(true);
			mockBufferManager.getTotalLength.mockReturnValue(10);

			streamBlockify.write('test');

			expect(mockBufferManager.getChunks).not.toHaveBeenCalled();
		});
	});

	describe('flush', () => {
		it('should emit full chunks and remaining data', () => {
			const fullChunk = Buffer.from('full chunk');
			const remainingData = Buffer.from('remaining');

			mockBufferManager.getChunks.mockReturnValue([fullChunk]);
			mockBufferManager.getRemainingData.mockReturnValue(remainingData);

			streamBlockify.flush();

			expect(dataEvents.length).toBe(2);
			expect(dataEvents[0]).toBe(fullChunk);
			expect(dataEvents[1]).toBe(remainingData);
			expect(mockBufferManager.clear).toHaveBeenCalled();
		});

		it('should skip remaining data if null', () => {
			const fullChunk = Buffer.from('full chunk');

			mockBufferManager.getChunks.mockReturnValue([fullChunk]);
			mockBufferManager.getRemainingData.mockReturnValue(null);

			streamBlockify.flush();

			expect(dataEvents.length).toBe(1);
			expect(dataEvents[0]).toBe(fullChunk);
			expect(mockBufferManager.clear).not.toHaveBeenCalled();
		});
	});
});
