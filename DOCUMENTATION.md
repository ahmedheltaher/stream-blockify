# stream-blockify Documentation

A Node.js library for processing streams in fixed-size blocks with advanced options for handling block boundaries, padding, and transformations.

## Table of Contents

- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [API Reference](#api-reference)
  - [StreamBlockify Class](#streamblockify-class)
  - [BlockifyOptions Interface](#blockifyoptions-interface)
  - [BlockifyError Class](#blockifyerror-class)
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
| `maximumBufferedBlocks` | `number` | No | `0` | Maximum blocks to buffer in memory. Set to 0 for no limit. |
| `blockTransform` | `(block: Buffer) => Buffer` | No | - | Transform function to apply to each block before emitting. The returned buffer will be pushed to the stream. |
| `highWaterMark` | `number` | No | `blockSize * 8` | The maximum number of bytes to store in the internal buffer. |

### BlockifyError Class

A custom error class that extends the built-in `Error` class to provide specific error messages for the library.

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
  maximumBufferedBlocks: 5, // Only buffer up to 5MB at a time
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
- The `maximumBufferedBlocks` option can help control memory usage for large files.
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
