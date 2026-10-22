import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, "../public/icons");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generatePng(size) {
  const width = size;
  const height = size;

  // Raw image data with filter byte (0) per row
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(rowBytes * height);

  const center = size / 2;
  const radius = size * 0.44;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Rounded rect / circle base with Neo-Brutalist border
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Icon: Scribe Indigo (#3222DD), with white mic/cassette glyph and ink border
      const isCorner = Math.abs(dx) > size * 0.42 && Math.abs(dy) > size * 0.42;

      if (dist <= radius && !isCorner) {
        // Border
        if (dist > radius - Math.max(1, size * 0.08)) {
          // Black border #171717
          rawData[pxOffset] = 0x17;
          rawData[pxOffset + 1] = 0x17;
          rawData[pxOffset + 2] = 0x17;
          rawData[pxOffset + 3] = 0xff;
        } else {
          // Inside: Indigo #3222DD
          let r = 0x32;
          let g = 0x22;
          let b = 0xdd;

          // Simple mic icon in center
          const micW = size * 0.22;
          const micH = size * 0.38;
          if (
            Math.abs(dx) < micW &&
            dy > -micH * 0.7 &&
            dy < micH * 0.4
          ) {
            // White mic body
            r = 0xff;
            g = 0xff;
            b = 0xff;
          } else if (
            Math.abs(dx) < size * 0.08 &&
            dy >= micH * 0.4 &&
            dy < micH * 0.75
          ) {
            // Mic stand
            r = 0xff;
            g = 0xff;
            b = 0xff;
          } else if (
            Math.abs(dx) < size * 0.24 &&
            dy >= micH * 0.75 &&
            dy < micH * 0.88
          ) {
            // Mic base
            r = 0xff;
            g = 0xff;
            b = 0xff;
          }

          rawData[pxOffset] = r;
          rawData[pxOffset + 1] = g;
          rawData[pxOffset + 2] = b;
          rawData[pxOffset + 3] = 0xff;
        }
      } else {
        // Transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk("IHDR", ihdrData);

  // IDAT
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk("IDAT", compressed);

  // IEND
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

for (const size of [16, 32, 48, 128]) {
  const pngBuf = generatePng(size);
  const filePath = path.join(outputDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, pngBuf);
  console.log(`Generated ${filePath}`);
}
