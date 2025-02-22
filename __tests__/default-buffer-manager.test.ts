import { DefaultBufferManager } from '../src/default-buffer-manager';

describe('DefaultBufferManager', () => {
	let bufferManager: DefaultBufferManager;

	beforeEach(() => {
		bufferManager = new DefaultBufferManager();
	});

	describe('addBuffer', () => {
		it('should add a buffer and update total length', () => {
			const buffer = Buffer.from('test');
			bufferManager.addBuffer(buffer);
			expect(bufferManager.getTotalLength()).toBe(4);
		});

		it('should handle multiple buffers', () => {
			bufferManager.addBuffer(Buffer.from('test1'));
			bufferManager.addBuffer(Buffer.from('test2'));
			expect(bufferManager.getTotalLength()).toBe(10);
		});

		it('should handle empty buffers', () => {
			bufferManager.addBuffer(Buffer.alloc(0));
			expect(bufferManager.getTotalLength()).toBe(0);
		});
	});

	describe('getTotalLength', () => {
		it('should return 0 for empty buffer manager', () => {
			expect(bufferManager.getTotalLength()).toBe(0);
		});

		it('should return cumulative length of all buffers', () => {
			bufferManager.addBuffer(Buffer.from('a'));
			bufferManager.addBuffer(Buffer.from('bc'));
			bufferManager.addBuffer(Buffer.from('def'));
			expect(bufferManager.getTotalLength()).toBe(6);
		});
	});

	describe('getChunks', () => {
		it('should return empty array when no data', () => {
			const chunks = bufferManager.getChunks(10);
			expect(chunks).toEqual([]);
		});

		it('should return no chunks when data is less than chunk size', () => {
			bufferManager.addBuffer(Buffer.from('test'));
			const chunks = bufferManager.getChunks(10);
			expect(chunks).toEqual([]);
			expect(bufferManager.getTotalLength()).toBe(4);
		});

		it('should return one chunk of exact chunk size', () => {
			bufferManager.addBuffer(Buffer.from('1234567890'));
			const chunks = bufferManager.getChunks(10);
			expect(chunks.length).toBe(1);
			expect(chunks[0].toString()).toBe('1234567890');
			expect(bufferManager.getTotalLength()).toBe(0);
		});

		it('should return multiple chunks of exact chunk size', () => {
			bufferManager.addBuffer(Buffer.from('12345678901234567890'));
			const chunks = bufferManager.getChunks(10);
			expect(chunks.length).toBe(2);
			expect(chunks[0].toString()).toBe('1234567890');
			expect(chunks[1].toString()).toBe('1234567890');
			expect(bufferManager.getTotalLength()).toBe(0);
		});

		it('should handle cross-buffer boundaries', () => {
			bufferManager.addBuffer(Buffer.from('12345'));
			bufferManager.addBuffer(Buffer.from('67890'));
			bufferManager.addBuffer(Buffer.from('abcde'));
			const chunks = bufferManager.getChunks(10);
			expect(chunks.length).toBe(1);
			expect(chunks[0].toString()).toBe('1234567890');
			expect(bufferManager.getTotalLength()).toBe(5);
		});

		it('should leave partial chunks in buffer', () => {
			bufferManager.addBuffer(Buffer.from('123456789012345'));
			const chunks = bufferManager.getChunks(10);
			expect(chunks.length).toBe(1);
			expect(bufferManager.getTotalLength()).toBe(5);
			const remaining = bufferManager.getRemainingData();
			expect(remaining?.toString()).toBe('12345');
		});

		it('should handle exact multiples with no remainder', () => {
			bufferManager.addBuffer(Buffer.from('1234567890'));
			bufferManager.addBuffer(Buffer.from('1234567890'));
			const chunks = bufferManager.getChunks(10);
			expect(chunks.length).toBe(2);
			expect(bufferManager.getTotalLength()).toBe(0);
			expect(bufferManager.getRemainingData()).toBe(null);
		});

		it('should optimize when single buffer exactly matches chunk size', () => {
			const exactBuffer = Buffer.from('1234567890');
			bufferManager.addBuffer(exactBuffer);
			const chunks = bufferManager.getChunks(10);
			expect(chunks.length).toBe(1);
			expect(chunks[0]).toStrictEqual(exactBuffer); // Should be the same buffer instance (optimization)
		});
	});

	describe('getRemainingData', () => {
		it('should return null when no data', () => {
			expect(bufferManager.getRemainingData()).toBe(null);
		});

		it('should return single buffer when only one exists', () => {
			const buffer = Buffer.from('test');
			bufferManager.addBuffer(buffer);
			const remaining = bufferManager.getRemainingData();
			expect(remaining?.toString()).toBe('test');
		});

		it('should combine multiple buffers', () => {
			bufferManager.addBuffer(Buffer.from('test1'));
			bufferManager.addBuffer(Buffer.from('test2'));
			const remaining = bufferManager.getRemainingData();
			expect(remaining?.toString()).toBe('test1test2');
		});

		it('should handle offset in first buffer', () => {
			bufferManager.addBuffer(Buffer.from('1234567890'));
			bufferManager.getChunks(5);
			const remaining = bufferManager.getRemainingData();
			expect(remaining).toBe(null);
		});

		it('should handle offset and multiple buffers', () => {
			bufferManager.addBuffer(Buffer.from('1234567890'));
			bufferManager.addBuffer(Buffer.from('abcde'));
			bufferManager.getChunks(12); // This consumes first 12 bytes
			const remaining = bufferManager.getRemainingData();
			expect(remaining?.toString()).toBe('cde');
		});
	});

	describe('clear', () => {
		it('should reset all internal state', () => {
			bufferManager.addBuffer(Buffer.from('test1'));
			bufferManager.addBuffer(Buffer.from('test2'));
			bufferManager.getChunks(5); // Create some internal offset

			bufferManager.clear();

			expect(bufferManager.getTotalLength()).toBe(0);
			expect(bufferManager.getRemainingData()).toBe(null);
		});
	});
});
