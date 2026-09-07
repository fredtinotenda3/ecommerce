// tests/imageDimensions.test.ts
//
// Header parsing for uploaded images.
//
// Dimensions are what let next/image reserve space before an image loads,
// so getting them wrong shows up as layout shift on every page using that
// image. Unreadable input must return null rather than throw: an image
// whose header this cannot parse is still a valid upload.

import { describe, expect, it } from 'vitest'

import { readImageDimensions } from '../src/lib/media/imageDimensions'

const buildPng = (width: number, height: number): Buffer => {
  const buffer = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0)
  buffer.write('IHDR', 12, 'ascii')
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return buffer
}

const buildGif = (width: number, height: number): Buffer => {
  const buffer = Buffer.alloc(10)
  buffer.write('GIF89a', 0, 'ascii')
  buffer.writeUInt16LE(width, 6)
  buffer.writeUInt16LE(height, 8)
  return buffer
}

/** A minimal JPEG: SOI, an APP0 segment to skip past, then an SOF0 frame
 * header carrying the dimensions. */
const buildJpeg = (width: number, height: number, appSegmentBytes = 16): Buffer => {
  const app = Buffer.alloc(appSegmentBytes)
  app[0] = 0xff
  app[1] = 0xe0
  app.writeUInt16BE(appSegmentBytes - 2, 2)

  const sof = Buffer.alloc(11)
  sof[0] = 0xff
  sof[1] = 0xc0
  sof.writeUInt16BE(9, 2)
  sof[4] = 8 // precision
  sof.writeUInt16BE(height, 5)
  sof.writeUInt16BE(width, 7)

  return Buffer.concat([Buffer.from([0xff, 0xd8]), app, sof])
}

describe('readImageDimensions', () => {
  it('reads PNG dimensions', () => {
    expect(readImageDimensions(buildPng(1024, 768))).toEqual({ width: 1024, height: 768 })
  })

  it('reads GIF dimensions', () => {
    expect(readImageDimensions(buildGif(320, 240))).toEqual({ width: 320, height: 240 })
  })

  it('reads JPEG dimensions past a leading APP segment', () => {
    expect(readImageDimensions(buildJpeg(640, 480))).toEqual({ width: 640, height: 480 })
  })

  it('skips a large metadata segment rather than stopping at it', () => {
    // A real photo's EXIF block is far bigger than the frame header that
    // follows it; walking segment lengths is what makes this work.
    expect(readImageDimensions(buildJpeg(200, 100, 4096))).toEqual({ width: 200, height: 100 })
  })

  it('returns null for a truncated header instead of throwing', () => {
    expect(readImageDimensions(Buffer.from([0x89, 0x50]))).toBeNull()
  })

  it('returns null for an unrecognised format', () => {
    expect(readImageDimensions(Buffer.from('not an image at all, just text'))).toBeNull()
  })

  it('returns null for a PNG whose IHDR chunk is missing', () => {
    const buffer = Buffer.alloc(24)
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0)
    buffer.write('OOPS', 12, 'ascii')

    expect(readImageDimensions(buffer)).toBeNull()
  })
})
