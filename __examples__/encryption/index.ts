/* eslint-disable no-console */

import { createCipheriv, randomBytes } from 'crypto';
import { Readable } from 'stream';
import { StreamBlockify } from '../../src';

/**
 * Encrypts a data stream in fixed-size blocks using AES-256-CBC
 *
 * @param inputData String data to encrypt
 * @param encryptionKey Buffer containing 32-byte encryption key
 * @returns Object containing IV and encrypted data
 */
async function encryptStreamInBlocks(inputData: string, encryptionKey: Buffer) {
	const source = Readable.from(Buffer.from(inputData));

	const initializationVector = randomBytes(16);
	console.log(`Using InitializationVector: ${initializationVector.toString('hex')}`);

	const blockify = new StreamBlockify({
		blockSize: 16, // AES block size
		emitPartial: false,
		padding: Buffer.from([16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16]),
		blockTransform: block => {
			const cipher = createCipheriv('aes-256-cbc', encryptionKey, initializationVector);
			cipher.setAutoPadding(false); // We're handling padding ourselves
			return Buffer.concat([cipher.update(block), cipher.final()]);
		}
	});

	let encryptedData = Buffer.alloc(0);
	blockify.on('data', chunk => {
		encryptedData = Buffer.concat([encryptedData, chunk]);
	});

	source.pipe(blockify);

	return new Promise<{ initializationVector: Buffer; encryptedData: Buffer }>(resolve => {
		blockify.on('end', () => {
			resolve({ initializationVector, encryptedData });
		});
	});
}

// Example usage
async function main() {
	const sensitiveData = 'This is a secret message that needs to be encrypted securely.';
	const encryptionKey = randomBytes(32);

	console.log('Original data:', sensitiveData);
	console.log('Key:', encryptionKey.toString('hex'));

	const result = await encryptStreamInBlocks(sensitiveData, encryptionKey);

	console.log('Encrypted data:', result.encryptedData.toString('hex'));
	console.log('InitializationVector:', result.initializationVector.toString('hex'));
	console.log('Encryption complete!');
}

main().catch(console.error);
