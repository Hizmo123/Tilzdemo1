// A minimal, dependency-free ZIP (STORE method — no compression) writer.
// Used by the admin fulfilment "Download QR pack" action (Task 4) to bundle
// N print-ready stand QR PNGs into one download. This project has a
// deliberate zero-new-npm-dependency policy, and there's no zip-capable
// library already installed (no jszip/archiver/adm-zip in package.json) —
// hand-writing the ZIP container format is entirely feasible (it's a well
// documented, fairly small binary format) and STORE is the right choice
// technically, not just the expedient one: the PNGs inside are already
// compressed, so re-deflating them would barely shrink the archive while
// adding real complexity (a DEFLATE implementation) for no real benefit.
//
// Reference: PKWARE's APPNOTE.TXT (the ZIP format spec). Implements exactly
// the subset needed here — one entry per file, STORE, no encryption, no
// Zip64 (not needed for a print run of stand QR codes).

const SIG_LOCAL_FILE = 0x04034b50;
const SIG_CENTRAL_DIR = 0x02014b50;
const SIG_END_OF_CENTRAL_DIR = 0x06054b50;

let crcTable: Int32Array | null = null;
function getCrcTable(): Int32Array {
  if (crcTable) return crcTable;
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  crcTable = table;
  return table;
}

function crc32(buf: Buffer): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// DOS date/time packed format, as ZIP requires — real values rather than
// zero, since some strict readers/OS unzip tools reject an all-zero date.
function dosDateTime(date: Date): { time: number; dosDate: number } {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2));
  const dosDate =
    ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, dosDate };
}

export type ZipEntry = { name: string; data: Buffer };

export function createZip(entries: ZipEntry[]): Buffer {
  const now = new Date();
  const { time, dosDate } = dosDateTime(now);
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(SIG_LOCAL_FILE, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(0, 8); // method: STORE
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18); // compressed size
    localHeader.writeUInt32LE(size, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    localParts.push(localHeader, nameBuf, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(SIG_CENTRAL_DIR, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(0, 10); // method: STORE
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20); // compressed size
    centralHeader.writeUInt32LE(size, 24); // uncompressed size
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // local header offset

    centralParts.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + entry.data.length;
  }

  const centralDirStart = offset;
  const centralDir = Buffer.concat(centralParts);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(SIG_END_OF_CENTRAL_DIR, 0);
  end.writeUInt16LE(0, 4); // disk number
  end.writeUInt16LE(0, 6); // disk with central dir
  end.writeUInt16LE(entries.length, 8); // entries on this disk
  end.writeUInt16LE(entries.length, 10); // total entries
  end.writeUInt32LE(centralDir.length, 12); // central dir size
  end.writeUInt32LE(centralDirStart, 16); // central dir offset
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localParts, centralDir, end]);
}
