/**
 * Tải @ffmpeg/core (ESM) vào next/public/ffmpeg để nối video same-origin
 * (tránh CSP connect-src chặn blob: từ toBlobURL).
 *
 * Chạy: node scripts/fetch-ffmpeg-core.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const VERSION = "0.12.6";
const OUT_DIR = path.join(__dirname, "..", "next", "public", "ffmpeg");
const BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${VERSION}/dist/esm`;
const FILES = ["ffmpeg-core.js", "ffmpeg-core.wasm"];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          download(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", (err) => {
        try {
          fs.unlinkSync(dest);
        } catch {
          // ignore
        }
        reject(err);
      });
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const name of FILES) {
    const dest = path.join(OUT_DIR, name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      console.log(`[ffmpeg-core] skip (exists): ${name}`);
      continue;
    }
    console.log(`[ffmpeg-core] downloading ${name}...`);
    await download(`${BASE}/${name}`, dest);
    console.log(`[ffmpeg-core] ok ${name} (${fs.statSync(dest).size} bytes)`);
  }
}

main().catch((err) => {
  console.error("[ffmpeg-core] failed:", err);
  process.exit(1);
});
