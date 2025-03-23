# stream-blockify Documentation

A Node.js library for processing streams in fixed-size blocks with advanced options for handling block boundaries, padding, and transformations.

## Table of Contents

- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [API Reference](#api-reference)
  - [StreamBlockify Class](#streamblockify-class)
  - [BlockifyOptions Interface](#blockifyoptions-interface)
  - [BlockifyError Class](#blockifyerror-class)
- [Debugging](#debugging)
  - [Enabling Debug Logs](#enabling-debug-logs)
  - [Log Levels](#log-levels)
  - [Debug Examples](#debug-examples)
- [Examples](#examples)
  - [Basic Block Processing](#basic-block-processing)
  - [Padding Incomplete Blocks](#padding-incomplete-blocks)
  - [Custom Block Transformation](#custom-block-transformation)
  - [Managing Memory Usage](#managing-memory-usage)
  - [Extra Examples](#extra-examples)
- [Performance Considerations](#performance-considerations)
- [Error Handling](#error-handling)

## Installation

```bash
npm install stream-blockify
```

or

```bash
yarn add stream-blockify
```

## Basic Usage

```typescript
import { StreamBlockify } from 'stream-blockify';
import { createReadStream, createWriteStream } from 'node:fs';

// Create a transform stream that processes data in 1024-byte blocks
const blockify = new StreamBlockify({
  blockSize: 1024
});

// Pipe data through the transform
createReadStream('input.dat')
  .pipe(blockify)
  .pipe(createWriteStream('output.dat'));
```

## API Reference

### StreamBlockify Class

The `StreamBlockify` class extends Node.js's `Transform` stream and processes incoming data in fixed-size blocks.

#### Constructor

```typescript
constructor(options: BlockifyOptions)
```

Creates a new `StreamBlockify` instance with the specified options.

Throws a `BlockifyError` if `blockSize` is not a positive integer.

#### Methods

##### `reset(): void`

Resets the internal state of the stream, setting the position to the beginning and clearing the count of buffered blocks.

##### `getPosition(): number`

Returns the current position within the internal buffer.

##### `getBufferedBlocksCount(): number`

Returns the current number of blocks being buffered.

### BlockifyOptions Interface

Configuration options for the `StreamBlockify` class.

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `blockSize` | `number` | Yes | - | Size of each block in bytes. Must be a positive integer. |
| `emitPartial` | `boolean` | No | `true` | Whether to emit partial blocks at the end of the stream. When `false`, the last block will be padded to the full block size. |
| `padding` | `number \| Buffer` | No | `0` | Padding byte or Buffer to use when padding the last block. Only used when `emitPartial` is `false`. |
| `safeAllocation` | `boolean` | No | `false` | Whether to allocate buffer as zeroed-out. Safer but slower than uninitialized allocation. |
| `onBlock` | `(block: Buffer) => void` | No | - | Function to call when a complete block is emitted. Called before pushing the block to the stream. |
| `blockTransform` | `(block: Buffer) => Buffer` | No | - | Transform function to apply to each block before emitting. The returned buffer will be pushed to the stream. |
| `highWaterMark` | `number` | No | `blockSize * 8` | The maximum number of bytes to store in the internal buffer. |

### BlockifyError Class

A custom error class that extends the built-in `Error` class to provide specific error messages for the library.

## Debugging

The library includes a powerful built-in debugging system based on the [debug](https://www.npmjs.com/package/debug) package that provides visibility into the stream processing lifecycle.

### Enabling Debug Logs

To enable debug logs, set the `DEBUG` environment variable:

```bash
# Enable all logs
DEBUG=STREAM-BLOCKIFY:* node your-app.js

# Enable only error logs
DEBUG=STREAM-BLOCKIFY:*:error node your-app.js

# Enable info and error logs
DEBUG=STREAM-BLOCKIFY:*:info,STREAM-BLOCKIFY:*:error node your-app.js
```

### Log Levels

The library uses the following log levels:

| Level | Description | When Used |
|-------|-------------|-----------|
| `error` | Critical errors that affect operation | Exception handling, validation failures |
| `warn` | Warning conditions |  resource constraints |
| `info` | General informational messages | Initialization, block emission, state changes |
| `debug` | Detailed debugging information | Block operations, data flow |
| `trace` | Fine-grained tracing information | Byte-level operations, buffer positions |

### Debug Examples

#### Tracking Block Processing

Debug logs provide visibility into block processing:

```log
STREAM-BLOCKIFY:StreamBlockify:info StreamBlockify initialized with blockSize: 1024, emitPartial: true, maxBufferedBlocks: 0 +0ms
STREAM-BLOCKIFY:StreamBlockify:debug Processing chunk of size 2048 bytes +2ms
STREAM-BLOCKIFY:StreamBlockify:trace Copied 1024 bytes, position: 1024/1024 +0ms
STREAM-BLOCKIFY:StreamBlockify:debug Block filled completely, emitting block of size 1024 +1ms
STREAM-BLOCKIFY:StreamBlockify:trace Buffered blocks count increased to 1 +0ms
STREAM-BLOCKIFY:StreamBlockify:trace Buffered blocks count decreased to 0 +0ms
STREAM-BLOCKIFY:StreamBlockify:trace Copied 1024 bytes, position: 1024/1024 +0ms
STREAM-BLOCKIFY:StreamBlockify:debug Block filled completely, emitting block of size 1024 +0ms
```

#### Tracking Final Block Handling

Debug logs show how final partial blocks are handled:

```log
STREAM-BLOCKIFY:StreamBlockify:info Emitting partial block of size 512 +3ms
```

or with padding:

```log
STREAM-BLOCKIFY:StreamBlockify:info Padding final block from position 512 to size 1024 +3ms
STREAM-BLOCKIFY:StreamBlockify:debug Applying numeric padding with value 0 for 512 bytes +0ms
```

## Examples

### Basic Block Processing

```typescript
import { StreamBlockify } from 'stream-blockify';
import { Readable } from 'node:stream';

// Create a source stream
const source = Readable.from(Buffer.alloc(4096, 'A'));

// Process in 1024-byte blocks
const blockify = new StreamBlockify({
  blockSize: 1024,
  onBlock: (block) => {
    console.log(`Got block of size ${block.length} bytes`);
  }
});

// Pipe and process the data
source.pipe(blockify).on('data', (block) => {
  console.log(`Block processed: ${block.length} bytes`);
});
```

### Padding Incomplete Blocks

```typescript
import { StreamBlockify } from 'stream-blockify';
import { Readable } from 'node:stream';

// Create a source stream with a size not divisible by the block size
const source = Readable.from(Buffer.alloc(3500, 'X'));

// Process in 1024-byte blocks with padding for the last block
const blockify = new StreamBlockify({
  blockSize: 1024,
  emitPartial: false,
  padding: Buffer.from('PAD'),  // Cyclic padding with 'PAD'
  onBlock: (block) => {
    console.log(`Block size: ${block.length}`);
  }
});

source.pipe(blockify);
```

### Custom Block Transformation

```typescript
import { StreamBlockify } from 'stream-blockify';
import { createReadStream, createWriteStream } from 'node:fs';

// Process file with encryption-like XOR transformation
const blockify = new StreamBlockify({
  blockSize: 1024,
  blockTransform: (block) => {
    // Example: Simple XOR transformation with a fixed key
    const key = Buffer.from('MY_SECRET_KEY');
    
    for (let i = 0; i < block.length; i++) {
      block[i] = block[i] ^ key[i % key.length];
    }
    
    return block;
  }
});

createReadStream('plaintext.dat')
  .pipe(blockify)
  .pipe(createWriteStream('encrypted.dat'));
```

### Managing Memory Usage

```typescript
import { StreamBlockify } from 'stream-blockify';
import { createReadStream, createWriteStream } from 'node:fs';

// Process a large file with limited memory usage
const blockify = new StreamBlockify({
  blockSize: 1024 * 1024, // 1MB blocks
  safeAllocation: true // Use safer allocation (zeroed)
});

createReadStream('large-file.dat')
  .pipe(blockify)
  .pipe(createWriteStream('processed-file.dat'))
  .on('finish', () => {
    console.log('File processing complete');
  });
```

### Extra Examples

Here are some more examples with advanced usage:

- [Basic Usage](./__examples__/basic-usage/index.ts)
- [Checksum](./__examples__/checksum/index.ts)
- [Dummy Network Protocol](./__examples__/network-protocol/index.ts)
- [Transformation](./__examples__/transformation/index.ts)

## Performance Considerations

- Setting `safeAllocation` to `false` (default) uses `Buffer.allocUnsafe()` which is faster but leaves buffer memory uninitialized.
- The `highWaterMark` option controls the stream buffering threshold. The default is `blockSize * 8`.
- When processing very large files, consider increasing the `highWaterMark` to improve throughput.
- For CPU-intensive `blockTransform` functions, consider keeping block sizes smaller.

## Error Handling

The library throws `BlockifyError` for specific validation errors. Additionally, errors that occur during block processing are emitted as 'error' events on the stream.

Example error handling:

```typescript
const blockify = new StreamBlockify({ blockSize: 1024 });

blockify.on('error', (err) => {
  console.error('Error in block processing:', err);
});

try {
  // This will throw BlockifyError
  const invalidBlockify = new StreamBlockify({ blockSize: -1 });
} catch (err) {
  console.error('Invalid configuration:', err);
}
```
