// src/lib/media/imageDimensions.ts
//
// Reads pixel dimensions out of an image's header bytes.
//
// The storefront's `<Media>` component passes width/height to next/image to
// reserve layout space; without them every image causes a layout shift as
// it loads. Those two numbers are the only thing needed from the file, so
// this parses the handful of header bytes that carry them rather than
// pulling in an image-processing dependency.
//
// Pure function over a Buffer — no I/O, and fully unit-testable.
//
// Returns `null` for anything it does not recognise, or for a truncated
// header. A caller must treat that as "unknown", never as an error: an
// image whose dimensions we cannot read is still a perfectly good upload.

export interface ImageDimensions {
  width: number
  height: number
}

const readPng = (buffer: Buffer): ImageDimensions | null => {
  // 8-byte signature, then an IHDR chunk whose data begins at offset 16.
  if (buffer.length < 24) return null
  if (buffer.readUInt32BE(12) !== 0x49484452) return null // "IHDR"
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

const readGif = (buffer: Buffer): ImageDimensions | null => {
  if (buffer.length < 10) return null
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) }
}

const readJpeg = (buffer: Buffer): ImageDimensions | null => {
  // Walk the marker segments looking for a start-of-frame (SOFn), which
  // carries the dimensions. Skipping by each segment's declared length is
  // what makes this safe on files with large EXIF or ICC blocks.
  let offset = 2 // past 0xFFD8

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = buffer[offset + 1]

    // SOF0-SOF3, SOF5-SOF7, SOF9-SOF11, SOF13-SOF15 carry dimensions.
    // 0xC4 (DHT), 0xC8 and 0xCC are not frame headers.
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc

    if (isFrameHeader) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) }
    }

    // Standalone markers (no length field): padding and RSTn.
    if (marker === 0xff || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2
      continue
    }

    const segmentLength = buffer.readUInt16BE(offset + 2)
    if (segmentLength < 2) return null
    offset += 2 + segmentLength
  }

  return null
}

const readWebp = (buffer: Buffer): ImageDimensions | null => {
  if (buffer.length < 30) return null
  const format = buffer.toString('ascii', 12, 16)

  if (format === 'VP8 ') {
    // Lossy: 14-bit dimensions after the 3-byte start code.
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    }
  }

  if (format === 'VP8L') {
    // Lossless: 14 bits each, packed across four bytes after the signature.
    const bits = buffer.readUInt32LE(21)
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    }
  }

  if (format === 'VP8X') {
    // Extended: 24-bit minus-one dimensions.
    const width = buffer.readUIntLE(24, 3) + 1
    const height = buffer.readUIntLE(27, 3) + 1
    return { width, height }
  }

  return null
}

export const readImageDimensions = (buffer: Buffer): ImageDimensions | null => {
  // Just enough to identify a format; each reader below checks that it has
  // the bytes its own header needs.
  if (buffer.length < 8) return null

  try {
    if (buffer.readUInt32BE(0) === 0x89504e47) return readPng(buffer)
    if (buffer.toString('ascii', 0, 3) === 'GIF') return readGif(buffer)
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return readJpeg(buffer)
    if (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return readWebp(buffer)
    }
  } catch {
    // A truncated or malformed header reads as "unknown", not an error.
    return null
  }

  return null
}
