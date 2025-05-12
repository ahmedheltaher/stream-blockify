/* eslint-disable no-console */

import { createReadStream, createWriteStream } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { StreamBlockify } from '../../src';

/**
 * Processes PCM audio data in fixed-size blocks (time chunks)
 *
 * @param audioFilePath Path to the raw PCM audio file
 * @param sampleRate Sample rate of the audio in Hz
 */
async function processPCMAudioInBlocks(audioFilePath: string, sampleRate: number) {
	// For 16-bit stereo audio, each sample is 4 bytes (2 channels × 2 bytes per sample)
	const bytesPerSample = 4;
	// Process audio in 50ms chunks
	const samplesPerChunk = sampleRate * 0.05;
	const blockSize = Math.floor(samplesPerChunk) * bytesPerSample;

	let maxAmplitude = 0;
	let totalBlocks = 0;

	const blockify = new StreamBlockify({
		blockSize,
		emitPartial: true,
		blockTransform: block => {
			totalBlocks++;

			// Example processing: find maximum amplitude in this block
			for (let i = 0; i < block.length; i += 2) {
				// Get 16-bit sample (signed)
				const sample = block.readInt16LE(i);
				const amplitude = Math.abs(sample);
				if (amplitude > maxAmplitude) {
					maxAmplitude = amplitude;
				}
			}

			// Just pass through the original audio data
			return block;
		}
	});

	const outputStream = createWriteStream(`${audioFilePath}.processed`);

	try {
		await pipeline(createReadStream(audioFilePath), blockify, outputStream);

		console.log(`Audio processing complete. Processed ${totalBlocks} blocks.`);
		console.log(
			`Maximum amplitude detected: ${maxAmplitude} (${((maxAmplitude / 32_767) * 100).toFixed(2)}% of maximum)`
		);
	} catch (error) {
		console.error('Error processing audio:', error);
	}
}

// Example usage
async function main() {
	const audioFileName = 'example-audio.pcm';
	const filePath = join(__dirname, audioFileName);
	const sampleRate = 44100; // 44.1 kHz

	console.log(`Processing audio file: ${audioFileName}`);
	await processPCMAudioInBlocks(filePath, sampleRate);
}

main().catch(console.error);
