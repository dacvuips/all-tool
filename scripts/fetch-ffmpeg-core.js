/**
 * Tải @ffmpeg/core (ESM) + copy worker ESM vào next/public/ffmpeg.
 *
 * classWorkerURL trỏ tới /ffmpeg/worker.js → bypass webpack bundle worker
 * (tránh "Cannot find module 'blob:…'" / 'http:…').
 *
 * Chạy: node scripts/fetch-ffmpeg-core.js
 * Force: FORCE=1 node scripts/fetch-ffmpeg-core.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const VERSION = "0.12.6";
const OUT_DIR = path.join(__dirname, "..", "next", "public", "ffmpeg");
const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${VERSION}/dist/esm`;
const CORE_FILES = ["ffmpeg-core.js", "ffmpeg-core.wasm"];

const FFMPEG_ESM = path.join(
  __dirname,
  "..",
  "node_modules",
  "@ffmpeg",
  "ffmpeg",
  "dist",
  "esm"
);
const WORKER_FILES = ["worker.js", "const.js", "errors.js"];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          try {
            fs.unlinkSync(dest);
          } catch {
            // ignore
          }
          download(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          try {
            fs.unlinkSync(dest);
          } catch {
            // ignore
          }
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

function isEsmCore(jsPath) {
  try {
    const s = fs.readFileSync(jsPath, "utf8");
    // ESM build: `export default createFFmpegCore` ở cuối file
    return /export\s+default\s+createFFmpegCore/.test(s.slice(-200)) || /export\s+default\s+/.test(s.slice(-200));
  } catch {
    return false;
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Worker ESM từ node_modules — luôn sync theo version @ffmpeg/ffmpeg đã cài
  for (const name of WORKER_FILES) {
    const src = path.join(FFMPEG_ESM, name);
    const dest = path.join(OUT_DIR, name);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing ${src} — chạy yarn install trước`);
    }
    fs.copyFileSync(src, dest);
    console.log(`[ffmpeg-core] copy worker: ${name} (${fs.statSync(dest).size} bytes)`);
  }

  for (const name of CORE_FILES) {
    const dest = path.join(OUT_DIR, name);
    const force = process.env.FORCE === "1";
    const exists = fs.existsSync(dest) && fs.statSync(dest).size > 1000;

    if (!force && exists) {
      if (name === "ffmpeg-core.js" && !isEsmCore(dest)) {
        console.log(`[ffmpeg-core] ${name} là UMD — tải lại ESM...`);
      } else {
        console.log(`[ffmpeg-core] skip (exists): ${name}`);
        continue;
      }
    }

    console.log(`[ffmpeg-core] downloading ${name} (esm)...`);
    await download(`${CORE_BASE}/${name}`, dest);
    console.log(`[ffmpeg-core] ok ${name} (${fs.statSync(dest).size} bytes)`);
  }

  if (!isEsmCore(path.join(OUT_DIR, "ffmpeg-core.js"))) {
    throw new Error("ffmpeg-core.js không phải ESM — kiểm tra CDN / FORCE=1");
  }
}

main().catch((err) => {
  console.error("[ffmpeg-core] failed:", err);
  process.exit(1);
});
