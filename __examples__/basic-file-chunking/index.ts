import { createReadStream, createWriteStream, stat } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { StreamBlockify } from '../../src';

const pipelineAsync = promisify(pipeline);
const statAsync = promisify(stat);

/**
 * Basic example showing how to use StreamBlockify to process a file in chunks
 * - Reads an input file
 * - Splits it into 1KB chunks
 * - Logs chunk information
 * - Writes the processed data to an output file
 */
async function processFileInChunks(inputPath: string, outputPath: string) {
	const chunkSize = 1024;
	const blockifier = new StreamBlockify({ size: chunkSize });

	blockifier.on('data', chunk => {
		// eslint-disable-next-line no-console
		console.log(`Processing chunk: ${chunk.length} bytes`);
	});

	try {
		// eslint-disable-next-line no-console
		console.log(`Reading file: ${inputPath}`);

		const stats = await statAsync(inputPath);
		// eslint-disable-next-line no-console
		console.log(`File size: ${stats.size} bytes`);
		// eslint-disable-next-line no-console
		console.log(
			`Expecting ${Math.ceil(stats.size / chunkSize)} chunks, each ${chunkSize} bytes and one chunk of ${stats.size % chunkSize} bytes`
		);

		await pipelineAsync(createReadStream(inputPath), blockifier, createWriteStream(outputPath));
		// eslint-disable-next-line no-console
		console.log('File processing completed successfully');
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error('Error processing file:', err);
		throw err;
	}
}

// Example usage
if (require.main === module) {
	const inputFilePath = join(__dirname, 'input.txt');
	const outputFilePath = join(__dirname, 'output.txt');
	processFileInChunks(inputFilePath, outputFilePath).catch(error => {
		// eslint-disable-next-line no-console
		console.error('Failed to process file:', error);
		process.exit(1);
	});
}
