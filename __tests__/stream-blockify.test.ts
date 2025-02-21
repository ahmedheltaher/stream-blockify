import { StreamBlockify } from '../src/stream-blockify';

describe('StreamBlockify', () => {
	let streamBlockify: StreamBlockify;

	beforeEach(() => {
		streamBlockify = new StreamBlockify();
	});

	it('should write data and emit chunks', done => {
		const data = Buffer.alloc(1024, 'a');
		const chunks: Buffer[] = [];

		streamBlockify.on('data', chunk => {
			chunks.push(chunk);
		});

		streamBlockify.write(data);

		setImmediate(() => {
			expect(chunks.length).toBe(2);
			expect(chunks[0].length).toBe(512);
			expect(chunks[1].length).toBe(512);
			done();
		});
	});

	it('should pause and resume emitting chunks', done => {
		const data = Buffer.alloc(1024, 'a');
		const chunks: Buffer[] = [];

		streamBlockify.on('data', chunk => {
			chunks.push(chunk);
		});

		streamBlockify.pause();
		streamBlockify.write(data);

		setImmediate(() => {
			expect(chunks.length).toBe(0);

			streamBlockify.resume();

			setImmediate(() => {
				expect(chunks.length).toBe(2);
				done();
			});
		});
	});

	it('should end the stream and emit remaining data', done => {
		const data = Buffer.alloc(256, 'a');
		const chunks: Buffer[] = [];

		streamBlockify.on('data', chunk => {
			chunks.push(chunk);
		});

		streamBlockify.on('end', () => {
			expect(chunks.length).toBe(1);
			expect(chunks[0].length).toBe(256);
			done();
		});

		streamBlockify.end(data);
	});

	it('should emit error on write after end', () => {
		streamBlockify.end();

		expect(() => {
			streamBlockify.write(Buffer.alloc(256, 'a'));
		}).toThrow('StreamBlockify: write after end');
	});

	it('should emit drain event when needed', done => {
		const data = Buffer.alloc(1024, 'a');

		streamBlockify.on('drain', () => {
			done();
		});

		streamBlockify.pause();
		streamBlockify.write(data);
		streamBlockify.resume();
	});
});
