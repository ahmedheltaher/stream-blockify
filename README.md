# stream-blockify

A powerful and flexible Node.js library for processing streams in fixed-size blocks. This library extends Node's Transform stream to provide block-based data processing with customizable options for handling partial blocks, applying padding, and transforming block content.

## Features

- Process streaming data in configurable fixed-size blocks
- Control handling of partial blocks at stream end (emit as-is or pad to full size)
- Apply custom padding for incomplete blocks (single byte value or buffer pattern)
- Execute callbacks for each completed block
- Implement custom block transformations
- Manage memory usage with block buffering limits
- Apply backpressure when buffer limits are reached
- Safe or fast buffer allocation options

## Use Cases

- Processing fixed-record format files
- Block-based encryption/decryption
- Audio/video frame processing
- Network protocol implementations
- Disk I/O optimization
- Performance-critical data processing pipelines

## Installation

```bash
npm install stream-blockify
```

## Simple Example

```typescript
import { StreamBlockify } from 'stream-blockify';
import { createReadStream, createWriteStream } from 'node:fs';

// Create a transform stream that processes data in 1024-byte blocks
const blockify = new StreamBlockify({
  blockSize: 1024,
  emitPartial: true
});

// Pipe a file through the transform stream
createReadStream('input.dat')
  .pipe(blockify)
  .pipe(createWriteStream('output.dat'));
```

Streamline your block-based data processing with fine-grained control and optimal performance.
