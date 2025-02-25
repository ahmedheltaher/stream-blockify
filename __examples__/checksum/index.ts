/* eslint-disable no-console */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { StreamBlockify } from '../../src/stream-blockify';

/**
 * Calculates MD5 checksums for each block of a file
 * @returns Promise that resolves when processing is complete
 */
async function run(): Promise<void> {
	// File setup
	const filePath = path.join(__dirname, 'example.txt');
	console.log('Checksumming - Calculate checksums per block');

	// Create streams
	const readStream = fs.createReadStream(filePath);
	const blockify = new StreamBlockify({
		blockSize: 1024,
		onBlock: block => {
			const md5sum = crypto.createHash('md5').update(block).digest('hex');
			console.log(`Block checksum (MD5): ${md5sum}`);
		}
	});

	// Track total data processed
	let totalSize = 0;

	return new Promise((resolve, reject) => {
		// Set up event handlers
		blockify.on('data', chunk => {
			totalSize += chunk.length;
		});

		blockify.on('end', () => {
			console.log(`Processed ${(totalSize / 1024).toFixed(2)} KB of data`);
			resolve();
		});

		// Connect streams and handle errors
		readStream.pipe(blockify).resume();
		readStream.on('error', reject);
		blockify.on('error', reject);
	});
}

// Run the example
run().catch(console.error);
