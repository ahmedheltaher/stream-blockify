/* eslint-disable no-console */

import { EventEmitter } from 'events';
import * as net from 'net';
import { Readable } from 'stream';
import { StreamBlockify } from '../../src';

class PacketReceiver extends EventEmitter {
	private server: net.Server;
	private blockify: StreamBlockify;
	private stats = { receivedPackets: 0, reassembledPackets: 0 };

	constructor(
		private port: number,
		private blockSize: number
	) {
		super();
		this.blockify = new StreamBlockify({
			blockSize: blockSize + 12,
			blockTransform: this.processPacket.bind(this)
		});

		this.server = net.createServer(this.handleConnection.bind(this));
		this.blockify.on('data', block => this.emit('data', block.subarray(12)));
	}

	private processPacket(packet: Buffer): Buffer {
		this.stats.receivedPackets++;

		const header = {
			sequenceNumber: packet.readUInt32LE(0),
			timestamp: packet.readDoubleLE(4),
			packetType: packet.readUInt32LE(8)
		};

		console.log(
			`[RECEIVER] Packet #${header.sequenceNumber}, ` +
				`size: ${packet.length} bytes, ` +
				`latency: ${(Date.now() - header.timestamp).toFixed(2)}ms`
		);

		return packet;
	}

	start(): Promise<void> {
		return new Promise(resolve => {
			this.server.listen(this.port, () => {
				console.log(`[RECEIVER] Server listening on port ${this.port}`);
				resolve();
			});
		});
	}

	private handleConnection(socket: net.Socket): void {
		console.log(`[RECEIVER] Connection from ${socket.remoteAddress}:${socket.remotePort}`);

		socket.on('data', data => this.blockify.write(data));
		socket.on('close', () => this.emit('end'));
		socket.on('error', err => console.error(`[RECEIVER] Socket error: ${err.message}`));
	}

	getStats() {
		return { ...this.stats };
	}

	stop(): Promise<void> {
		return new Promise(resolve => {
			this.server.close(() => {
				console.log('[RECEIVER] Server stopped');
				resolve();
			});
		});
	}
}

async function transmitPackets(dataStream: Readable, packetSize: number, host: string, port: number): Promise<number> {
	return new Promise((resolve, reject) => {
		let sequenceNumber = 0;
		let sentPackets = 0;

		const socket = net.createConnection({ host, port }, () => {
			console.log(`[SENDER] Connected to ${host}:${port}`);

			const blockify = new StreamBlockify({
				blockSize: packetSize,
				emitPartial: true,
				blockTransform: block => {
					const packet = Buffer.alloc(block.length + 12);
					packet.writeUInt32LE(sequenceNumber++, 0);
					packet.writeDoubleLE(Date.now(), 4);
					packet.writeUInt32LE(block.length, 8);
					block.copy(packet, 12);
					return packet;
				}
			});

			blockify.on('data', packet => {
				sentPackets++;
				socket.write(packet);
			});

			blockify.on('end', () => socket.end());
			dataStream.pipe(blockify);
		});

		socket.on('close', () => resolve(sentPackets));
		socket.on('error', reject);
	});
}

async function main() {
	const PORT = 3000;
	const HOST = 'localhost';
	const PACKET_SIZE = 128;

	const receiver = new PacketReceiver(PORT, PACKET_SIZE);
	const originalData = 'This is example data that will be split into network packets.'.repeat(100);
	const dataStream = Readable.from(Buffer.from(originalData));

	await receiver.start();

	try {
		const packetCount = await transmitPackets(dataStream, PACKET_SIZE, HOST, PORT);
		await new Promise(resolve => setTimeout(resolve, 500));

		const stats = receiver.getStats();
		console.log('\n--- Transmission Summary ---');
		console.log(`Sent packets: ${packetCount}`);
		console.log(`Received packets: ${stats.receivedPackets}`);

		await receiver.stop();
	} catch (error) {
		console.error('Transmission error:', error);
	}
}

main().catch(console.error);
