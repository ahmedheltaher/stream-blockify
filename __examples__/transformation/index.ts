/* eslint-disable no-console */
import { Readable } from 'stream';
import { StreamBlockify } from '../../src/stream-blockify';

/**
 * Demonstrates using StreamBlockify to transform text to uppercase in blocks
 * @returns Promise that resolves when the transformation is complete
 */
async function run(): Promise<void> {
	console.log('Transformation - Converting text to uppercase in blocks');

	// Input data
	const inputText = 'this is a test of the block transformation feature';
	const source = Readable.from([inputText]);

	// Configure the blockify transform
	const blockify = new StreamBlockify({
		blockSize: 10,
		blockTransform: block => Buffer.from(block.toString().toUpperCase()),
		onBlock: block => console.log(`Block: "${block.toString()}"`)
	});

	return new Promise(resolve => {
		const chunks: Buffer[] = [];

		// Collect and process the transformed data
		blockify.on('data', chunk => chunks.push(chunk));
		blockify.on('end', () => {
			console.log(`\nFinal result: "${Buffer.concat(chunks).toString()}"`);
			resolve();
		});

		// Connect the streams
		source.pipe(blockify);
	});
}

// Run the example
run().catch(console.error);
