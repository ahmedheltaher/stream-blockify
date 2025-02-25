import { createReadStream } from 'node:fs';
import path from 'node:path';
import { BlockifyOptions, StreamBlockify } from '../src';
import { Benchmark } from './benchmark';
import { BENCHMARK_RESULTS_DIRECTORY } from './constants';
import { DevNullStream } from './dev-null-stream';

type RunBenchmarkOptions = Omit<BlockifyOptions, 'blockSize'>;

export type BenchmarkCase = {
	description: string;
	blockSize: number;
	options?: RunBenchmarkOptions;
};

export type BenchmarkSet = {
	name: string;
	cases: Array<BenchmarkCase>;
};

/**
 * Run a benchmark for a specific configuration
 *
 * @param {string} name - The name of the benchmark.
 * @param {string} filePath - The path to the file to be used in the benchmark.
 * @param {number} blockSize - The size of the blocks to be used in the benchmark.
 * @param {RunBenchmarkOptions} [options={}] - Additional options for the StreamBlockify instance, excluding blockSize.
 * @returns {Promise<void>} - A promise that resolves when the benchmark is complete.
 */
export async function runBenchmark(
	name: string,
	filePath: string,
	blockSize: number,
	options: RunBenchmarkOptions = {}
): Promise<void> {
	return new Promise((resolve, reject) => {
		const benchmark = new Benchmark(name, { blockSize, ...options });
		const source = createReadStream(filePath);
		const sink = new DevNullStream();
		const blockify = new StreamBlockify({ blockSize, ...options });

		const handleError = (error: Error) => reject(error);

		source.on('error', handleError);
		blockify.on('error', handleError);
		sink.on('error', handleError);

		sink.on('finish', () => {
			benchmark.end(sink.getBytesWritten());
			benchmark.log();
			benchmark.writeResults(
				path.join(BENCHMARK_RESULTS_DIRECTORY, `${name.replace(/\s/g, '-').toLowerCase()}.json`)
			);
			resolve();
		});

		benchmark.start();
		source.pipe(blockify).pipe(sink);
	});
}
