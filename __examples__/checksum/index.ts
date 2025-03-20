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
	const filePath = path.join(__dirname, 'example.txt');
	console.log('Checksumming - Calculate checksums per block');

	const readStream = fs.createReadStream(filePath);
	const blockify = new StreamBlockify({
		blockSize: 1024,
		onBlock: block => {
			const md5sum = crypto.createHash('md5').update(block).digest('hex');
			console.log(`Block checksum (MD5): ${md5sum}`);
		}
	});

	let totalSize = 0;

	return new Promise((resolve, reject) => {
		blockify.on('data', chunk => {
			totalSize += chunk.length;
		});

		blockify.on('end', () => {
			console.log(`Processed ${(totalSize / 1024).toFixed(2)} KB of data`);
			resolve();
		});

		readStream.pipe(blockify).resume();
		readStream.on('error', reject);
		blockify.on('error', reject);
	});
}

run().catch(console.error);
