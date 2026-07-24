/**
 * Đóng gói Local Agent cho khách (không đưa source).
 * yarn build-scrape-agent
 */
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "release", "shopee-scrape-agent");
const entry = path.join(root, "src", "tools", "shopee-scrape-agent", "server.ts");
const stubLogger = path.join(
  root,
  "src",
  "tools",
  "shopee-scrape-agent",
  "console-logger.ts"
);
const configStub = path.join(
  root,
  "src",
  "tools",
  "shopee-scrape-agent",
  "config-stub.js"
);
const outfile = path.join(outDir, "agent.js");
const runner = path.join(outDir, "_bundle.cjs");

fs.mkdirSync(outDir, { recursive: true });

function writeSupportFiles() {
  fs.writeFileSync(
    path.join(outDir, "BatDau.bat"),
    [
      "@echo off",
      "chcp 65001 >nul",
      "cd /d \"%~dp0\"",
      "set SUPPRESS_NO_CONFIG_WARNING=1",
      "echo.",
      "echo  === Shopee Scrape Agent ===",
      "echo  Giữ cửa sổ này mở khi dùng tab Cào dữ liệu trên web.",
      "echo  Thoát: Ctrl+C hoặc đóng cửa sổ.",
      "echo.",
      "if exist ShopeeScrapeAgent.exe (",
      "  ShopeeScrapeAgent.exe",
      ") else if exist agent.js (",
      "  where node >nul 2>&1",
      "  if errorlevel 1 (",
      "    echo [Loi] Thieu ShopeeScrapeAgent.exe va khong tim thay Node.js.",
      "    pause",
      "    exit /b 1",
      "  )",
      "  node agent.js",
      ") else (",
      "  echo [Loi] Khong tim thay ShopeeScrapeAgent.exe / agent.js",
      "  pause",
      "  exit /b 1",
      ")",
      "pause",
      "",
    ].join("\r\n"),
    "utf8"
  );

  fs.writeFileSync(
    path.join(outDir, "HUONG-DAN.txt"),
    [
      "Shopee Scrape Agent — bản cho khách",
      "====================================",
      "",
      "1. Cài và mở GemLogin Desktop (API localhost:1010).",
      "   Profile đã đăng nhập Shopee Affiliate.",
      "2. Double-click BatDau.bat (hoặc ShopeeScrapeAgent.exe).",
      "3. Giữ cửa sổ Agent mở.",
      "4. Mở trang web sản phẩm → tab Cào dữ liệu.",
      "   Thấy \"Agent + GemLogin\" là dùng được.",
      "",
      "Agent chỉ lắng nghe máy bạn: http://127.0.0.1:17890",
      "Không cần source code / yarn.",
      "",
      "Gặp lỗi port đang dùng: đóng Agent cũ rồi mở lại.",
      "",
    ].join("\r\n"),
    "utf8"
  );
}

function main() {
  // Plugin đơn giản: mọi import app logger + package `config` → stub
  fs.writeFileSync(
    runner,
    `
const path = require("path");
const esbuild = require("esbuild");

const stubLogger = ${JSON.stringify(stubLogger)};
const configStub = ${JSON.stringify(configStub)};

function shouldStubLogger(args) {
  const spec = String(args.path || "").replace(/\\\\/g, "/");
  const importer = String(args.importer || "").replace(/\\\\/g, "/");
  if (spec.includes("console-logger") || importer.includes("console-logger")) return false;
  if (spec.includes("node_modules") || importer.includes("/node_modules/")) return false;
  if (spec.includes("helpers/logger")) return true;
  if (
    (spec === "../logger" || spec === "./logger" || /\\/logger(\\.ts|\\.js)?$/.test(spec)) &&
    (importer.includes("/shopee-affiliate-scrape/") || importer.includes("/shopee-scrape-agent/"))
  ) {
    return true;
  }
  try {
    const resolved = path.resolve(args.resolveDir || "", args.path).replace(/\\\\/g, "/");
    if (/\\/helpers\\/logger(\\.ts|\\.js)?$/i.test(resolved)) return true;
  } catch (_) {}
  return false;
}

esbuild
  .build({
    entryPoints: [${JSON.stringify(entry)}],
    bundle: true,
    platform: "node",
    target: "node18",
    outfile: ${JSON.stringify(outfile)},
    sourcemap: false,
    minify: true,
    plugins: [
      {
        name: "stub-logger-config",
        setup(build) {
          build.onResolve({ filter: /^config$/ }, () => ({ path: configStub }));
          build.onResolve({ filter: /.*/ }, (args) => {
            if (shouldStubLogger(args)) return { path: stubLogger };
          });
        },
      },
    ],
    banner: {
      js: [
        "/* Shopee Scrape Local Agent — bundled; do not edit */",
        "process.env.SUPPRESS_NO_CONFIG_WARNING = process.env.SUPPRESS_NO_CONFIG_WARNING || '1';",
        "try { if (process.pkg) { process.chdir(require('path').dirname(process.execPath)); } } catch (_) {}",
      ].join("\\n"),
    },
  })
  .then(() => console.log("[build-scrape-agent] esbuild OK"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
`,
    "utf8"
  );

  console.log("[build-scrape-agent] Đang bundle bằng npx esbuild…");
  execSync(`npx --yes --package=esbuild node "${runner}"`, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      npm_config_ignore_scripts: "true",
      npm_config_audit: "false",
      npm_config_fund: "false",
    },
  });

  try {
    fs.unlinkSync(runner);
  } catch {
    /* ignore */
  }

  if (!fs.existsSync(outfile)) {
    throw new Error("Không tạo được agent.js");
  }

  // Sanity: không còn kéo config logger
  const bundled = fs.readFileSync(outfile, "utf8");
  if (bundled.includes('logger.debug') || /require\(["']config["']\)/.test(bundled)) {
    console.warn(
      "[build-scrape-agent] CẢNH BÁO: agent.js vẫn có dấu hiệu package config — kiểm tra stub."
    );
  } else {
    console.log("[build-scrape-agent] OK: không thấy config/logger.debug trong bundle");
  }

  writeSupportFiles();
  console.log(`[build-scrape-agent] ${outfile}`);

  try {
    console.log("[build-scrape-agent] Đóng gói .exe…");
    execSync(
      `npx --yes @yao-pkg/pkg "${outfile}" --targets node18-win-x64 --output "${path.join(
        outDir,
        "ShopeeScrapeAgent.exe"
      )}"`,
      {
        cwd: root,
        stdio: "inherit",
        shell: true,
        env: {
          ...process.env,
          npm_config_ignore_scripts: "true",
          npm_config_audit: "false",
          npm_config_fund: "false",
        },
      }
    );
    console.log("[build-scrape-agent] ShopeeScrapeAgent.exe OK");
  } catch {
    console.warn(
      "[build-scrape-agent] Chưa có .exe — zip vẫn dùng được với Node: BatDau.bat → node agent.js"
    );
  }

  console.log(`[build-scrape-agent] Gửi khách (zip cả thư mục): ${outDir}`);

  const zipPath = path.join(root, "release", "ShopeeScrapeAgent.zip");
  const publicDir = path.join(root, "next", "public", "downloads");
  const publicZip = path.join(publicDir, "ShopeeScrapeAgent.zip");
  fs.mkdirSync(publicDir, { recursive: true });
  try {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${outDir.replace(
        /'/g,
        "''"
      )}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force"`,
      { cwd: root, stdio: "inherit", shell: true }
    );
    fs.copyFileSync(zipPath, publicZip);
    console.log(`[build-scrape-agent] Web download → ${publicZip}`);
  } catch (err) {
    console.warn(
      "[build-scrape-agent] Không tạo được zip cho /downloads/.",
      err && err.message ? err.message : err
    );
  }
}

main();
