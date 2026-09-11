import { utf8, writePhotoZip } from "./photoZipArchive";

describe("streamed photo ZIP", () => {
  it("writes UTF-8 names, correct offsets, CRC and unchanged binary content", async () => {
    const output: Buffer[] = [];
    async function* chunks() { yield utf8("1234"); yield utf8("56789"); }
    async function* entries() {
      yield { path: "Mémoire/海.jpg", chunks: chunks() };
      yield { path: "empty/", chunks: (async function* () {})() };
    }
    await writePhotoZip(entries(), (bytes) => output.push(Buffer.from(bytes)));
    const zip = Buffer.concat(output);
    const end = zip.length - 22;
    expect(zip.readUInt32LE(end)).toBe(0x06054b50);
    expect(zip.readUInt16LE(end + 10)).toBe(2);
    const central = zip.readUInt32LE(end + 16);
    expect(zip.readUInt32LE(central)).toBe(0x02014b50);
    expect(zip.readUInt32LE(central + 16)).toBe(0xcbf43926);
    expect(zip.readUInt32LE(central + 20)).toBe(9);
    expect(zip.readUInt32LE(central + 42)).toBe(0);
    const nameLength = zip.readUInt16LE(26);
    expect(zip.subarray(30, 30 + nameLength).toString("utf8")).toBe("Mémoire/海.jpg");
    expect(zip.readUInt16LE(6) & 0x800).toBe(0x800);
    expect(zip.readUInt16LE(8)).toBe(0); // STORE, never recompress images.
    expect(zip.subarray(30 + nameLength, 39 + nameLength).toString()).toBe("123456789");
    expect(zip.readUInt32LE(39 + nameLength)).toBe(0x08074b50);
    expect(zip.readUInt32LE(end + 12)).toBe(end - central);
  });

  it("propagates read errors instead of finalizing a corrupt partial archive", async () => {
    async function* chunks() { yield new Uint8Array([1, 2]); throw new Error("read failed"); }
    async function* entries() { yield { path: "photo.jpg", chunks: chunks() }; }
    await expect(writePhotoZip(entries(), () => undefined)).rejects.toThrow("read failed");
  });

  it("rejects paths escaping the archive", async () => {
    async function* entries() { yield { path: "../photo.jpg", chunks: (async function* () {})() }; }
    await expect(writePhotoZip(entries(), () => undefined)).rejects.toThrow("Invalid ZIP filename");
  });
});
