/* eslint-disable no-console */

import fs from 'fs';
import path from 'path';
import { StreamBlockify } from '../../src/stream-blockify';

/**
 * Processes a file in 1KB blocks and writes the output to a new file.
 *
 * @returns {Promise<void>} A promise that resolves when the processing is complete.
 */
async function run(): Promise<void> {
	const inputPath = path.join(__dirname, 'example.txt');
	const outputPath = path.join(__dirname, 'output.txt');

	console.log('Basic Usage - Processing a file in 1KB blocks');

	const readStream = fs.createReadStream(inputPath);
	const writeStream = fs.createWriteStream(outputPath);
	const blockify = new StreamBlockify({ blockSize: 1024 });

	let blockCount = 0;

	// Increment block count and log progress every 100 blocks
	blockify.on('data', () => {
		blockCount++;
		if (blockCount % 100 === 0) process.stdout.write('.');
	});

	return new Promise((resolve, reject) => {
		// Pipe the read stream through blockify and then to the write stream
		readStream.pipe(blockify).pipe(writeStream);

		// Resolve the promise when writing is finished
		writeStream.on('finish', () => {
			console.log(`\nProcessed ${blockCount} blocks of 1KB each`);
			resolve();
		});

		// Handle errors
		readStream.on('error', reject);
		blockify.on('error', reject);
		writeStream.on('error', reject);
	});
}

// Run the function and catch any errors
run().catch(console.error);
