import { DefaultBufferManager } from '../src/default-buffer-manager';

describe('DefaultBufferManager', () => {
	let bufferManager: DefaultBufferManager;

	beforeEach(() => {
		bufferManager = new DefaultBufferManager();
	});

	test('should add buffer and update total length', () => {
		const buffer = Buffer.from('test');
		bufferManager.addBuffer(buffer);
		expect(bufferManager.getTotalLength()).toBe(buffer.length);
	});

	test('should return total length of buffers', () => {
		const buffer1 = Buffer.from('test1');
		const buffer2 = Buffer.from('test2');
		bufferManager.addBuffer(buffer1);
		bufferManager.addBuffer(buffer2);
		expect(bufferManager.getTotalLength()).toBe(buffer1.length + buffer2.length);
	});

	test('should return chunks of specified size', () => {
		const buffer = Buffer.from('testtest');
		bufferManager.addBuffer(buffer);
		const chunks = bufferManager.getChunks(4);
		expect(chunks.length).toBe(2);
		expect(chunks[0].toString()).toBe('test');
		expect(chunks[1].toString()).toBe('test');
	});

	test('should clear all buffers and reset total length and offset', () => {
		const buffer = Buffer.from('test');
		bufferManager.addBuffer(buffer);
		bufferManager.clear();
		expect(bufferManager.getTotalLength()).toBe(0);
		expect(bufferManager.getRemainingData()).toBeNull();
	});

	test('should return remaining data as a single buffer', () => {
		const buffer1 = Buffer.from('test1');
		const buffer2 = Buffer.from('test2');
		bufferManager.addBuffer(buffer1);
		bufferManager.addBuffer(buffer2);
		const remainingData = bufferManager.getRemainingData();
		expect(remainingData).not.toBeNull();
		expect(remainingData!.toString()).toBe('test1test2');
	});

	test('should return null if no remaining data', () => {
		expect(bufferManager.getRemainingData()).toBeNull();
	});

	test('should handle chunking when buffer is smaller than chunk size', () => {
		const buffer = Buffer.from('test');
		bufferManager.addBuffer(buffer);
		const chunks = bufferManager.getChunks(8);
		expect(chunks.length).toBe(0);
		expect(bufferManager.getTotalLength()).toBe(buffer.length);
	});

	test('should handle chunking with multiple buffers', () => {
		const buffer1 = Buffer.from('test1');
		const buffer2 = Buffer.from('test2');
		bufferManager.addBuffer(buffer1);
		bufferManager.addBuffer(buffer2);
		const chunks = bufferManager.getChunks(5);
		expect(chunks.length).toBe(2);
		expect(chunks[0].toString()).toBe('test1');
		expect(chunks[1].toString()).toBe('test1');
	});

	test('should handle partial chunking with offset', () => {
		const buffer1 = Buffer.from('test1');
		const buffer2 = Buffer.from('test2');
		bufferManager.addBuffer(buffer1);
		bufferManager.addBuffer(buffer2);
		const chunks = bufferManager.getChunks(7);
		expect(chunks.length).toBe(1);
		expect(chunks[0].toString()).toBe('test1te');
		expect(bufferManager.getTotalLength()).toBe(7);
		expect(bufferManager.getRemainingData()!.toString()).toBe('2');
	});

	test('should handle empty buffer manager', () => {
		expect(bufferManager.getTotalLength()).toBe(0);
		expect(bufferManager.getChunks(4).length).toBe(0);
		expect(bufferManager.getRemainingData()).toBeNull();
	});
});
