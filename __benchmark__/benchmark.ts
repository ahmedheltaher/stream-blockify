/* eslint-disable no-console */
import { writeFileSync } from 'fs';
import { performance } from 'perf_hooks';
import { ONE_MB } from './constants';

/**
 * Benchmark class for measuring StreamBlockify performance
 */
export class Benchmark {
	private name: string;
	private startTime: number = 0;
	private endTime: number = 0;
	private bytesProcessed: number = 0;

	/**
	 * Creates an instance of Benchmark.
	 * @param name - The name of the benchmark.
	 * @param options - Additional options for the benchmark.
	 */
	constructor(
		name: string,
		private options: Record<string, unknown> = {}
	) {
		this.name = name;
		this.options = options;
	}

	/**
	 * Starts the benchmark timer.
	 */
	start(): void {
		this.startTime = performance.now();
	}

	/**
	 * Ends the benchmark timer and records the bytes processed.
	 * @param bytesProcessed - The number of bytes processed during the benchmark.
	 */
	end(bytesProcessed: number): void {
		this.endTime = performance.now();
		this.bytesProcessed = bytesProcessed;
	}

	/**
	 * Gets the duration of the benchmark in milliseconds.
	 * @returns The duration in milliseconds.
	 */
	get durationMs(): number {
		return this.endTime - this.startTime;
	}

	/**
	 * Gets the throughput in megabytes per second.
	 * @returns The throughput in MB/s.
	 */
	get throughputMBps(): number {
		const seconds = this.durationMs / 1000;
		const bytesProcessedInMegabytes = this.bytesProcessed / ONE_MB;
		return bytesProcessedInMegabytes / seconds;
	}

	/**
	 * Logs the benchmark results to the console.
	 */
	log(): void {
		const optionsString = Object.entries(this.options)
			.map(([key, value]) => `\t\t${key}: ${value}`)
			.join('\n');

		console.log('========================================');
		console.log(`[${this.name}]`);
		if (optionsString) {
			console.log('\tOptions:');
			console.log('\t--------------------------------');
			console.log(optionsString);
			console.log('\t--------------------------------');
		}
		console.log(`\tDuration: ${this.durationMs.toFixed(2)} ms`);
		console.log(`\tThroughput: ${this.throughputMBps.toFixed(2)} MB/s`);
		console.log(`\tData processed: ${(this.bytesProcessed / ONE_MB).toFixed(2)} MB`);
		console.log('========================================');
		console.log();
	}

	/**
	 * Writes the benchmark results to a JSON file.
	 * @param filePath - The path to the file to write the results to.
	 */
	writeResults(filePath: string): void {
		const results = {
			name: this.name,
			options: this.options,
			durationMs: this.durationMs,
			throughputMBps: this.throughputMBps,
			bytesProcessed: this.bytesProcessed
		};

		const json = JSON.stringify(
			results,
			(_key, value) => {
				if (typeof value === 'function') {
					return value
						.toString()
						.replace(/\n/g, '')
						.replace(/\s{2,}/g, ' ');
				}
				return value;
			},
			4
		);
		writeFileSync(filePath, json);
	}
}
