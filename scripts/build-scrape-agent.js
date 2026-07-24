/**
 * Đóng gói Local Agent cho khách (Windows + macOS).
 * yarn build-scrape-agent
 */
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "release", "shopee-scrape-agent");
const outWinDir = path.join(root, "release", "shopee-scrape-agent-windows");
const outMacDir = path.join(root, "release", "shopee-scrape-agent-macos");
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

function writeWinSupport(dir) {
  fs.writeFileSync(
    path.join(dir, "BatDau.bat"),
    [
      "@echo off",
      "chcp 65001 >nul",
      "cd /d \"%~dp0\"",
      "set SUPPRESS_NO_CONFIG_WARNING=1",
      "echo.",
      "echo  === Shopee Scrape Agent (Windows) ===",
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
    path.join(dir, "HUONG-DAN.txt"),
    [
      "Shopee Scrape Agent — Windows",
      "=============================",
      "",
      "1. Cài và mở GemLogin Desktop (API localhost:1010).",
      "2. Double-click BatDau.bat (hoặc ShopeeScrapeAgent.exe).",
      "3. Giữ cửa sổ Agent mở.",
      "4. Web → tab Cào dữ liệu → thấy Agent + GemLogin.",
      "",
      "http://127.0.0.1:17890",
      "",
    ].join("\r\n"),
    "utf8"
  );
}

function writeMacSupport(dir) {
  // .command: double-click trên Finder (Terminal)
  fs.writeFileSync(
    path.join(dir, "BatDau.command"),
    [
      "#!/bin/bash",
      'cd "$(dirname "$0")"',
      "export SUPPRESS_NO_CONFIG_WARNING=1",
      "echo",
      'echo " === Shopee Scrape Agent (macOS) ==="',
      'echo " Giữ cửa sổ này mở khi dùng tab Cào dữ liệu trên web."',
      'echo " Thoát: Ctrl+C hoặc đóng cửa sổ."',
      "echo",
      "ARCH=$(uname -m)",
      'BIN=""',
      'if [ "$ARCH" = "arm64" ] && [ -x "./ShopeeScrapeAgent-macos-arm64" ]; then',
      '  BIN="./ShopeeScrapeAgent-macos-arm64"',
      'elif [ -x "./ShopeeScrapeAgent-macos-x64" ]; then',
      '  BIN="./ShopeeScrapeAgent-macos-x64"',
      'elif [ -x "./ShopeeScrapeAgent-macos-arm64" ]; then',
      '  BIN="./ShopeeScrapeAgent-macos-arm64"',
      "fi",
      'if [ -n "$BIN" ]; then',
      '  exec "$BIN"',
      "fi",
      "if command -v node >/dev/null 2>&1 && [ -f ./agent.js ]; then",
      "  exec node agent.js",
      "fi",
      'echo "[Lỗi] Không tìm thấy binary macOS hoặc Node.js + agent.js"',
      "read -r -p \"Nhấn Enter để đóng...\" _",
      "exit 1",
      "",
    ].join("\n"),
    "utf8"
  );

  fs.writeFileSync(
    path.join(dir, "HUONG-DAN-MAC.txt"),
    [
      "Shopee Scrape Agent — macOS (MacBook)",
      "====================================",
      "",
      "1. Cài và mở GemLogin Desktop (nếu có bản Mac).",
      "2. Lần đầu macOS chặn app chưa ký:",
      "   - Chuột phải BatDau.command → Open",
      "   - hoặc Terminal:",
      "     cd thư-mục-này",
      "     chmod +x BatDau.command ShopeeScrapeAgent-macos-*",
      "     xattr -cr .",
      "     ./BatDau.command",
      "3. Apple Silicon (M1/M2/M3): dùng ShopeeScrapeAgent-macos-arm64",
      "   Intel Mac: dùng ShopeeScrapeAgent-macos-x64",
      "4. Giữ Terminal/Agent mở → web Cào dữ liệu.",
      "",
      "http://127.0.0.1:17890",
      "",
      "Fallback: cài Node.js rồi chạy: node agent.js",
      "",
    ].join("\n"),
    "utf8"
  );
}

function copyIfExists(src, dest) {
  if (fs.existsSync(src)) fs.copyFileSync(src, dest);
}

function zipDir(sourceDir, zipPath) {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${sourceDir.replace(
      /'/g,
      "''"
    )}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force"`,
    { cwd: root, stdio: "inherit", shell: true }
  );
}

function pkgTarget(target, outputName) {
  const out = path.join(outDir, outputName);
  console.log(`[build-scrape-agent] pkg ${target} → ${outputName}`);
  execSync(
    `npx --yes @yao-pkg/pkg "${outfile}" --targets ${target} --output "${out}"`,
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
}

function main() {
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

  const bundled = fs.readFileSync(outfile, "utf8");
  if (bundled.includes("logger.debug") || /require\(["']config["']\)/.test(bundled)) {
    console.warn("[build-scrape-agent] CẢNH BÁO: agent.js vẫn có dấu hiệu package config");
  } else {
    console.log("[build-scrape-agent] OK: không thấy config/logger.debug trong bundle");
  }

  writeWinSupport(outDir);
  writeMacSupport(outDir);

  const targets = [
    ["node18-win-x64", "ShopeeScrapeAgent.exe"],
    ["node18-macos-arm64", "ShopeeScrapeAgent-macos-arm64"],
    ["node18-macos-x64", "ShopeeScrapeAgent-macos-x64"],
  ];
  for (const [target, name] of targets) {
    try {
      pkgTarget(target, name);
    } catch (err) {
      console.warn(`[build-scrape-agent] Không tạo được ${name}:`, err && err.message ? err.message : err);
    }
  }

  // Package Windows zip
  fs.rmSync(outWinDir, { recursive: true, force: true });
  fs.mkdirSync(outWinDir, { recursive: true });
  copyIfExists(outfile, path.join(outWinDir, "agent.js"));
  copyIfExists(path.join(outDir, "ShopeeScrapeAgent.exe"), path.join(outWinDir, "ShopeeScrapeAgent.exe"));
  writeWinSupport(outWinDir);

  // Package macOS zip
  fs.rmSync(outMacDir, { recursive: true, force: true });
  fs.mkdirSync(outMacDir, { recursive: true });
  copyIfExists(outfile, path.join(outMacDir, "agent.js"));
  copyIfExists(
    path.join(outDir, "ShopeeScrapeAgent-macos-arm64"),
    path.join(outMacDir, "ShopeeScrapeAgent-macos-arm64")
  );
  copyIfExists(
    path.join(outDir, "ShopeeScrapeAgent-macos-x64"),
    path.join(outMacDir, "ShopeeScrapeAgent-macos-x64")
  );
  writeMacSupport(outMacDir);

  const publicDir = path.join(root, "next", "public", "downloads");
  fs.mkdirSync(publicDir, { recursive: true });

  const zipWin = path.join(root, "release", "ShopeeScrapeAgent-windows.zip");
  const zipMac = path.join(root, "release", "ShopeeScrapeAgent-macos.zip");
  const zipLegacy = path.join(root, "release", "ShopeeScrapeAgent.zip");

  try {
    zipDir(outWinDir, zipWin);
    fs.copyFileSync(zipWin, path.join(publicDir, "ShopeeScrapeAgent-windows.zip"));
    fs.copyFileSync(zipWin, path.join(publicDir, "ShopeeScrapeAgent.zip")); // legacy UI link
    fs.copyFileSync(zipWin, zipLegacy);
    console.log(`[build-scrape-agent] Windows zip → ${zipWin}`);
  } catch (err) {
    console.warn("[build-scrape-agent] Zip Windows thất bại:", err && err.message ? err.message : err);
  }

  try {
    zipDir(outMacDir, zipMac);
    fs.copyFileSync(zipMac, path.join(publicDir, "ShopeeScrapeAgent-macos.zip"));
    console.log(`[build-scrape-agent] macOS zip → ${zipMac}`);
  } catch (err) {
    console.warn("[build-scrape-agent] Zip macOS thất bại:", err && err.message ? err.message : err);
  }

  console.log("[build-scrape-agent] Xong.");
  console.log(`  Windows: ${path.join(publicDir, "ShopeeScrapeAgent-windows.zip")}`);
  console.log(`  macOS:   ${path.join(publicDir, "ShopeeScrapeAgent-macos.zip")}`);
}

main();
