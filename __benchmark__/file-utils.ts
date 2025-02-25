import crypto from 'node:crypto';
import fileSystem from 'node:fs';
import path from 'node:path';
import { BENCHMARK_DIRECTORY, ONE_MB } from './constants';

/**
 * Creates a test file with random content of the specified size.
 *
 * @param sizeInMB - The size of the file to create in megabytes.
 * @param filename - The name of the file to create.
 * @returns A promise that resolves to the path of the created file.
 */
export async function createTestFile(sizeInMB: number, filename: string): Promise<string> {
	const filePath = path.join(BENCHMARK_DIRECTORY, filename);

	await createDirectory(BENCHMARK_DIRECTORY);

	return new Promise((resolve, reject) => {
		const writeStream = fileSystem.createWriteStream(filePath);
		let bytesWritten = 0;
		const targetBytes = sizeInMB * ONE_MB;

		const writeChunk = () => {
			const chunkSize = Math.min(ONE_MB, targetBytes - bytesWritten);
			if (chunkSize <= 0) {
				writeStream.end(() => resolve(filePath));
				return;
			}

			const buffer = crypto.randomBytes(chunkSize);
			const canContinue = writeStream.write(buffer);
			bytesWritten += chunkSize;

			if (canContinue) {
				process.nextTick(writeChunk);
			} else {
				writeStream.once('drain', writeChunk);
			}
		};

		writeStream.on('error', reject);
		writeChunk();
	});
}

/**
 * Cleans up the test files by deleting the specified file and the benchmark directory.
 *
 * @param filePath - The path of the file to delete.
 */
export function cleanUpTestFiles(filePath: string): void {
	fileSystem.unlinkSync(filePath);
	fileSystem.rmdirSync(BENCHMARK_DIRECTORY);
}
/**
 * Creates a directory if it does not exist.
 *
 * @param dirPath - The path of the directory to create.
 * @returns A promise that resolves when the directory is created.
 */
export async function createDirectory(dirPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		fileSystem.mkdir(dirPath, { recursive: true }, error => {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}
