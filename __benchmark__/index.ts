/* eslint-disable no-console */
import { benchmarkSets } from './benchmark-sets';
import { BENCHMARK_RESULTS_DIRECTORY } from './constants';
import { cleanUpTestFiles, createDirectory, createTestFile } from './file-utils';
import { BenchmarkSet, runBenchmark } from './run-benchmark';

/**
 * Main benchmark function
 */
async function runBenchmarks(benchmarkSets: Array<BenchmarkSet>): Promise<void> {
	try {
		console.log('Preparing benchmark data...');
		const filePath = await createTestFile(100, 'benchmark-100mb.dat');
		console.log(`Created test file: ${filePath}`);

		console.log('Creating benchmark results directory...');
		await createDirectory(BENCHMARK_RESULTS_DIRECTORY);
		console.log(`Created benchmark results directory: ${BENCHMARK_RESULTS_DIRECTORY}`);

		console.log('\n=== StreamBlockify Benchmarks ===\n');

		for (const set of benchmarkSets) {
			console.log(`\n${set.name}\n`);
			for (const benchmarkCase of set.cases) {
				await runBenchmark(benchmarkCase.description, filePath, benchmarkCase.blockSize, benchmarkCase.options);
			}
		}

		// Clean up
		console.log('\nCleaning up...');
		cleanUpTestFiles(filePath);

		console.log('Benchmarks completed successfully!');
	} catch (error) {
		console.error('Benchmark error:', error);
	}
}

// Only run when directly executed
if (require.main === module) {
	runBenchmarks(benchmarkSets);
}
