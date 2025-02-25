/* eslint-disable no-console */

import net from 'net';
import { Readable } from 'stream';
import { StreamBlockify } from '../../src';

// Configuration constants
const CONFIG = {
	PORT: 4000,
	HOST: '127.0.0.1',
	MAGIC: 0xab_cd,
	PADDING: 0x00,
	PACKET_STRUCTURE: {
		MAGIC_SIZE: 2,
		MESSAGE_ID_SIZE: 2,
		MESSAGE_LENGTH_SIZE: 2,
		PAYLOAD_SIZE: 32
	}
};

// Derived constants
const HEADER_SIZE =
	CONFIG.PACKET_STRUCTURE.MAGIC_SIZE +
	CONFIG.PACKET_STRUCTURE.MESSAGE_LENGTH_SIZE +
	CONFIG.PACKET_STRUCTURE.MESSAGE_ID_SIZE;

/**
 * Creates network packets from a message
 * @param message - The message to packetize
 * @param messageId - Unique identifier for the message
 * @returns Promise resolving to an array of packet buffers
 */
async function createPackets(message: string, messageId: number): Promise<Buffer[]> {
	const messageBuffer = Buffer.from(message);
	const messageLength = messageBuffer.length;

	const blockify = new StreamBlockify({
		blockSize: CONFIG.PACKET_STRUCTURE.PAYLOAD_SIZE,
		emitPartial: false,
		padding: CONFIG.PADDING,
		blockTransform: block => {
			const header = Buffer.alloc(HEADER_SIZE);
			header.writeUInt16BE(CONFIG.MAGIC, 0);
			header.writeUInt16BE(messageLength, 2);
			header.writeUInt16BE(messageId, 4);
			return Buffer.concat([header, block]);
		}
	});

	const messageStream = Readable.from([messageBuffer]);

	return new Promise(resolve => {
		const collectedPackets: Buffer[] = [];
		blockify.on('data', (packet: Buffer) => collectedPackets.push(packet));
		blockify.on('end', () => resolve(collectedPackets));
		messageStream.pipe(blockify);
	});
}

/**
 * Interface for storing received message data
 */
interface ReceivedMessage {
	length: number;
	data: string;
}

/**
 * Starts a server that listens for and processes incoming packets
 */
function startServer(): void {
	const server = net.createServer(socket => {
		console.log('\n📥 Server listening for packets...');

		const receivedMessages: Record<number, ReceivedMessage> = {};
		const blockify = new StreamBlockify({
			blockSize: CONFIG.PACKET_STRUCTURE.PAYLOAD_SIZE + HEADER_SIZE,
			emitPartial: false
		});

		socket.pipe(blockify);

		blockify.on('data', packet => {
			const magicBytes = packet.readUInt16BE(0);
			const messageLength = packet.readUInt16BE(2);
			const messageId = packet.readUInt16BE(4);
			const messageData = packet
				.slice(HEADER_SIZE, HEADER_SIZE + messageLength)
				.toString()
				.replace(/\0+$/, '');

			if (magicBytes !== CONFIG.MAGIC) {
				console.error('❌ Invalid packet received');
				return;
			}

			if (!receivedMessages[messageId]) {
				receivedMessages[messageId] = { length: messageLength, data: '' };
			}
			receivedMessages[messageId].data += messageData;
		});

		blockify.on('end', () => {
			logReconstructedMessages(receivedMessages);
			closeServerAfterDelay(socket, server);
		});
	});

	server.listen(CONFIG.PORT, CONFIG.HOST, () => {
		console.log(`🚀 Server running at ${CONFIG.HOST}:${CONFIG.PORT}`);
	});
}

/**
 * Logs all reconstructed messages to the console
 */
function logReconstructedMessages(messages: Record<number, ReceivedMessage>): void {
	console.log('\n🔄 Reconstructed Messages:');
	Object.entries(messages).forEach(([id, message]) => {
		console.log(`📧 Message ID ${id}: "${message.data}"`);
	});
	console.log('✅ All messages reconstructed!');
}

/**
 * Closes the server after a short delay
 */
function closeServerAfterDelay(socket: net.Socket, server: net.Server, delay = 1000): void {
	setTimeout(() => {
		console.log('🔌 Closing server...');
		socket.end();
		server.close();
		console.log('🚪 Server closed');
	}, delay);
}

/**
 * Creates and sends packets to the server
 */
async function sendPackets(): Promise<void> {
	const messages = [
		'Hello',
		'This is a longer message that will span multiple blocks, and will need to be reassembled on the server',
		'Short',
		'Another message that will need padding',
		'The final message in our simulation'
	];

	const allPackets = (await Promise.all(messages.map((message, index) => createPackets(message, index)))).flat();

	const client = net.createConnection({ port: CONFIG.PORT, host: CONFIG.HOST }, () => {
		console.log('\n📡 Sending Network Packets');

		allPackets.forEach(packet => {
			client.write(packet, () => {});
			logPacketDetails(packet);
		});

		client.end();
	});

	client.on('end', () => console.log('✅ All packets sent!'));
}

/**
 * Logs details about a sent packet
 */
function logPacketDetails(packet: Buffer): void {
	console.log(
		`📦 Sent Packet: Magic=0x${packet.readUInt16BE(0).toString(16).toUpperCase()}, ` +
			`ID=${packet.readUInt16BE(4)}, ` +
			`Length=${packet.readUInt16BE(2)}, ` +
			`Data="${packet.subarray(HEADER_SIZE).toString().replace(/\0+$/, '')}"`
	);
}

// Run the example
startServer();
setTimeout(sendPackets, 1000);
