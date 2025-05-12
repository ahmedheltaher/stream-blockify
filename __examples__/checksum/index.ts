/* eslint-disable no-console */

import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { StreamBlockify } from '../../src';

/**
 * Processes a file in blocks and calculates checksums for each block
 *
 * @param inputFilePath Path to the input file
 */
async function processFileWithChecksums(inputFilePath: string) {
	const blockify = new StreamBlockify({
		blockSize: 4096,
		emitPartial: true,
		onBlock: block => {
			const hash = createHash('sha256').update(block).digest('hex');
			console.log(`Block checksum: ${hash}`);
		}
	});

	let blockCount = 0;
	blockify.on('data', () => {
		blockCount++;
	});

	try {
		await pipeline(createReadStream(inputFilePath), blockify);
		console.log(`Processed ${blockCount} blocks from file`);
	} catch (error) {
		console.error('Error processing file:', error);
	}
}

async function main() {
	const fileName = 'example-data-file.bin';
	const filePath = join(__dirname, fileName);

	console.log(`Processing file: ${filePath}`);
	await processFileWithChecksums(filePath);
}

main().catch(console.error);
