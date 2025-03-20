import { ONE_MB } from './constants';
import { BenchmarkSet } from './run-benchmark';

export const benchmarkSets: Array<BenchmarkSet> = [
	{
		name: 'Benchmark Set 1: Block Size Impact',
		cases: [
			{ description: 'Block Size: 512 bytes', blockSize: 512 },
			{ description: 'Block Size: 4 KB', blockSize: 4 * 1024 },
			{ description: 'Block Size: 64 KB', blockSize: 64 * 1024 },
			{ description: 'Block Size: 1 MB', blockSize: ONE_MB }
		]
	},
	{
		name: 'Benchmark Set 3: Safe Allocation Impact',
		cases: [
			{
				description: 'With safeAllocation: true',
				blockSize: 64 * 1024,
				options: { safeAllocation: true }
			},
			{
				description: 'With safeAllocation: false',
				blockSize: 64 * 1024,
				options: { safeAllocation: false }
			}
		]
	},
	{
		name: 'Benchmark Set 4: Block Transform Impact',
		cases: [
			{ description: 'No transformation', blockSize: 64 * 1024 },
			{
				description: 'With simple transformation',
				blockSize: 64 * 1024,
				options: {
					blockTransform: (block: Buffer) => block
				}
			},
			{
				description: 'With complex transformation',
				blockSize: 64 * 1024,
				options: {
					blockTransform: (block: Buffer) => {
						const newBuffer = Buffer.allocUnsafe(block.length);
						for (let i = 0; i < block.length; i++) {
							newBuffer[i] = block[i] ^ 0xff; // XOR operation
						}
						return newBuffer;
					}
				}
			}
		]
	},
	{
		name: 'Benchmark Set 5: Backpressure Handling',
		cases: [
			{ description: 'No max buffered blocks', blockSize: 64 * 1024 },
			{
				description: 'With max 5 buffered blocks',
				blockSize: 64 * 1024,
				options: { maximumBufferedBlocks: 5 }
			},
			{
				description: 'With max 1 buffered blocks',
				blockSize: 64 * 1024,
				options: { maximumBufferedBlocks: 1 }
			}
		]
	}
];
