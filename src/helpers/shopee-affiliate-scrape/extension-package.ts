/**
 * Đóng gói thư mục Chrome extension thành ZIP để tải về.
 */

import fs from "fs";
import path from "path";
import JSZip from "jszip";

const EXTENSION_DIR_NAME = "shopee-affiliate-bridge";

export function getExtensionSourceDir() {
  return path.join(process.cwd(), "extensions", EXTENSION_DIR_NAME);
}

async function addFolderToZip(zip: JSZip, absDir: string, zipPrefix: string) {
  if (!fs.existsSync(absDir)) {
    throw new Error(`Không tìm thấy thư mục extension: ${absDir}`);
  }
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(absDir, entry.name);
    const rel = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await addFolderToZip(zip, abs, rel);
    } else if (entry.isFile()) {
      zip.file(rel, new Uint8Array(fs.readFileSync(abs)));
    }
  }
}

export async function buildExtensionZipBuffer(): Promise<{
  buffer: Buffer;
  filename: string;
  fileCount: number;
}> {
  const sourceDir = getExtensionSourceDir();
  if (!fs.existsSync(path.join(sourceDir, "manifest.json"))) {
    throw new Error("Thiếu manifest.json trong extensions/shopee-affiliate-bridge");
  }

  const zip = new JSZip();
  // Root folder trong ZIP → giải nén ra đúng folder để Load unpacked
  await addFolderToZip(zip, sourceDir, EXTENSION_DIR_NAME);

  const files = Object.keys(zip.files).filter((k) => !zip.files[k].dir);
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    buffer: Buffer.from(buffer),
    filename: `${EXTENSION_DIR_NAME}.zip`,
    fileCount: files.length,
  };
}
