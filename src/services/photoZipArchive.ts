// ZIP STORE preserves already-compressed image files byte for byte. Data is
// streamed; only the central-directory records are retained in memory.
export type ZipSource = { path: string; chunks: AsyncIterable<Uint8Array> };

export function utf8(value: string): Uint8Array {
  const encoded = unescape(encodeURIComponent(value));
  return Uint8Array.from(encoded, (char) => char.charCodeAt(0));
}

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

function record(size: number, fields: [number, number, 2 | 4][]): Uint8Array {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  for (const [offset, value, width] of fields) {
    if (width === 2) view.setUint16(offset, value, true);
    else view.setUint32(offset, value, true);
  }
  return bytes;
}

export async function writePhotoZip(
  sources: AsyncIterable<ZipSource>,
  write: (bytes: Uint8Array) => void
): Promise<void> {
  let offset = 0;
  const directory: Uint8Array[] = [];
  let count = 0;
  const emit = (bytes: Uint8Array) => {
    if (offset + bytes.length >= 0xffffffff) throw new Error("This export exceeds the 4 GB ZIP limit. Export a smaller project.");
    write(bytes);
    offset += bytes.length;
  };
  for await (const source of sources) {
    if (++count >= 65535) throw new Error("This export contains too many files for a single ZIP.");
    const name = utf8(source.path);
    if (!name.length || name.length > 65535 || source.path.startsWith("/") || source.path.split("/").some((part) => part === "..")) {
      throw new Error("Invalid ZIP filename.");
    }
    const start = offset;
    // UTF-8 + streaming data descriptor, stored compression, DOS date 1980-01-01.
    emit(record(30, [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x808, 2], [12, 33, 2], [26, name.length, 2]]));
    emit(name);
    let crc = 0xffffffff;
    let size = 0;
    for await (const bytes of source.chunks) {
      for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
      size += bytes.length;
      emit(bytes);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    emit(record(16, [[0, 0x08074b50, 4], [4, crc, 4], [8, size, 4], [12, size, 4]]));
    directory.push(record(46, [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x808, 2], [14, 33, 2],
      [16, crc, 4], [20, size, 4], [24, size, 4], [28, name.length, 2], [42, start, 4]]), name);
  }
  const directoryStart = offset;
  for (const bytes of directory) emit(bytes);
  const directorySize = offset - directoryStart;
  emit(record(22, [[0, 0x06054b50, 4], [8, count, 2], [10, count, 2], [12, directorySize, 4], [16, directoryStart, 4]]));
}
