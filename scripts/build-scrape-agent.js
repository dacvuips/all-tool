/**
 * Đóng gói Local Agent cho khách (Windows + macOS).
 * Chỉ phân phối agent.js + BatDau (tự cài Node portable nếu thiếu).
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

/** Node LTS portable — BatDau tải về .runtime nếu máy chưa có node */
const NODE_PORTABLE_VERSION = "v22.16.0";

fs.mkdirSync(outDir, { recursive: true });

function writeWinSupport(dir) {
  fs.writeFileSync(
    path.join(dir, "BatDau.bat"),
    [
      "@echo off",
      "setlocal EnableExtensions",
      "chcp 65001 >nul",
      "cd /d \"%~dp0\"",
      "set SUPPRESS_NO_CONFIG_WARNING=1",
      "set \"NODE_VER=" + NODE_PORTABLE_VERSION + "\"",
      "set \"RUNTIME_DIR=%~dp0.runtime\"",
      "set \"NODE_CMD=\"",
      "echo.",
      "echo  === Shopee Scrape Agent (Windows) ===",
      "echo  Giữ cửa sổ này mở khi dùng tab Cào dữ liệu trên web.",
      "echo  Thoát: Ctrl+C hoặc đóng cửa sổ.",
      "echo.",
      "if not exist \"%~dp0agent.js\" (",
      "  echo [Loi] Thieu agent.js trong thu muc nay.",
      "  pause",
      "  exit /b 1",
      ")",
      "",
      "where node >nul 2>&1",
      "if not errorlevel 1 (",
      "  for /f \"delims=\" %%i in ('where node') do (",
      "    set \"NODE_CMD=%%i\"",
      "    goto :have_node",
      "  )",
      ")",
      "",
      "if exist \"%RUNTIME_DIR%\\node.exe\" (",
      "  set \"NODE_CMD=%RUNTIME_DIR%\\node.exe\"",
      "  goto :have_node",
      ")",
      "",
      "echo [Thong bao] Chua co Node.js - dang tai ban portable (chi lan dau)...",
      "call :install_portable_node",
      "if errorlevel 1 (",
      "  echo [Loi] Khong cai duoc Node.js. Thu cai tay tai https://nodejs.org roi chay lai BatDau.bat",
      "  pause",
      "  exit /b 1",
      ")",
      "set \"NODE_CMD=%RUNTIME_DIR%\\node.exe\"",
      "",
      ":have_node",
      "echo  Dung Node: %NODE_CMD%",
      "echo.",
      "\"%NODE_CMD%\" \"%~dp0agent.js\"",
      "set \"EXITCODE=%ERRORLEVEL%\"",
      "echo.",
      "pause",
      "exit /b %EXITCODE%",
      "",
      ":install_portable_node",
      "set \"ZIP=%TEMP%\\node-%NODE_VER%-win-x64.zip\"",
      "set \"URL=https://nodejs.org/dist/%NODE_VER%/node-%NODE_VER%-win-x64.zip\"",
      "set \"EXTRACT=%TEMP%\\node-%NODE_VER%-extract\"",
      "if exist \"%EXTRACT%\" rmdir /s /q \"%EXTRACT%\" 2>nul",
      "echo  URL: %URL%",
      "powershell -NoProfile -ExecutionPolicy Bypass -Command ^",
      "  \"$ErrorActionPreference='Stop'; \" ^",
      "  \"[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; \" ^",
      "  \"Invoke-WebRequest -Uri $env:URL -OutFile $env:ZIP; \" ^",
      "  \"if (Test-Path $env:EXTRACT) { Remove-Item -Recurse -Force $env:EXTRACT }; \" ^",
      "  \"Expand-Archive -Path $env:ZIP -DestinationPath $env:EXTRACT -Force\"",
      "if errorlevel 1 exit /b 1",
      "if not exist \"%EXTRACT%\\node-%NODE_VER%-win-x64\\node.exe\" (",
      "  echo [Loi] Giai nen Node that bai.",
      "  exit /b 1",
      ")",
      "if exist \"%RUNTIME_DIR%\" rmdir /s /q \"%RUNTIME_DIR%\" 2>nul",
      "mkdir \"%RUNTIME_DIR%\" >nul 2>&1",
      "xcopy /e /i /y /q \"%EXTRACT%\\node-%NODE_VER%-win-x64\\*\" \"%RUNTIME_DIR%\\\" >nul",
      "if not exist \"%RUNTIME_DIR%\\node.exe\" (",
      "  echo [Loi] Khong copy duoc node.exe vao .runtime",
      "  exit /b 1",
      ")",
      "echo  Da cai Node portable vao .runtime\\",
      "exit /b 0",
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
      "2. Double-click BatDau.bat",
      "   - Đã có Node.js trên máy → chạy Agent ngay.",
      "   - Chưa có → BatDau tự tải Node portable vào thư mục .runtime (chỉ lần đầu).",
      "3. Giữ cửa sổ Agent mở.",
      "4. Web → tab Cào dữ liệu → thấy Agent + GemLogin.",
      "",
      "http://127.0.0.1:17890",
      "",
      "Lưu ý: cần mạng khi lần đầu tải Node. Không cần cài Node thủ công.",
      "",
    ].join("\r\n"),
    "utf8"
  );
}

function writeMacSupport(dir) {
  fs.writeFileSync(
    path.join(dir, "BatDau.command"),
    [
      "#!/bin/bash",
      'cd "$(dirname "$0")"',
      "export SUPPRESS_NO_CONFIG_WARNING=1",
      'NODE_VER="' + NODE_PORTABLE_VERSION + '"',
      'RUNTIME_DIR="$(pwd)/.runtime"',
      "echo",
      'echo " === Shopee Scrape Agent (macOS) ==="',
      'echo " Giữ cửa sổ này mở khi dùng tab Cào dữ liệu trên web."',
      'echo " Thoát: Ctrl+C hoặc đóng cửa sổ."',
      "echo",
      'if [ ! -f ./agent.js ]; then',
      '  echo "[Lỗi] Thiếu agent.js trong thư mục này."',
      '  read -r -p "Nhấn Enter để đóng..." _',
      "  exit 1",
      "fi",
      "",
      "resolve_node() {",
      "  if command -v node >/dev/null 2>&1; then",
      "    NODE_CMD=$(command -v node)",
      "    return 0",
      "  fi",
      '  if [ -x "$RUNTIME_DIR/bin/node" ]; then',
      '    NODE_CMD="$RUNTIME_DIR/bin/node"',
      "    return 0",
      "  fi",
      "  return 1",
      "}",
      "",
      "install_portable_node() {",
      '  echo "[Thông báo] Chưa có Node.js — đang tải bản portable (chỉ lần đầu)..."',
      '  ARCH=$(uname -m)',
      '  if [ "$ARCH" = "arm64" ]; then',
      '    PLAT="darwin-arm64"',
      "  else",
      '    PLAT="darwin-x64"',
      "  fi",
      '  TGZ="/tmp/node-${NODE_VER}-${PLAT}.tar.gz"',
      '  URL="https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-${PLAT}.tar.gz"',
      '  echo " URL: $URL"',
      '  if command -v curl >/dev/null 2>&1; then',
      '    curl -fsSL "$URL" -o "$TGZ" || return 1',
      '  elif command -v wget >/dev/null 2>&1; then',
      '    wget -q -O "$TGZ" "$URL" || return 1',
      "  else",
      '    echo "[Lỗi] Cần curl hoặc wget để tải Node."',
      "    return 1",
      "  fi",
      '  rm -rf "$RUNTIME_DIR"',
      '  mkdir -p "$RUNTIME_DIR"',
      '  tar -xzf "$TGZ" -C "$RUNTIME_DIR" --strip-components=1 || return 1',
      '  if [ ! -x "$RUNTIME_DIR/bin/node" ]; then',
      '    echo "[Lỗi] Giải nén Node thất bại."',
      "    return 1",
      "  fi",
      '  echo " Đã cài Node portable vào .runtime/"',
      "  return 0",
      "}",
      "",
      "if ! resolve_node; then",
      "  if ! install_portable_node; then",
      '    echo "[Lỗi] Không cài được Node.js. Cài tay tại https://nodejs.org rồi chạy lại."',
      '    read -r -p "Nhấn Enter để đóng..." _',
      "    exit 1",
      "  fi",
      '  NODE_CMD="$RUNTIME_DIR/bin/node"',
      "fi",
      "",
      'echo " Dùng Node: $NODE_CMD"',
      "echo",
      'exec "$NODE_CMD" ./agent.js',
      "",
    ].join("\n"),
    "utf8"
  );

  try {
    fs.chmodSync(path.join(dir, "BatDau.command"), 0o755);
  } catch {
    /* Windows build host may ignore chmod */
  }

  fs.writeFileSync(
    path.join(dir, "HUONG-DAN-MAC.txt"),
    [
      "Shopee Scrape Agent — macOS (MacBook)",
      "====================================",
      "",
      "1. Cài và mở GemLogin Desktop (nếu có bản Mac).",
      "2. Lần đầu macOS có thể chặn app chưa ký:",
      "   - Chuột phải BatDau.command → Open",
      "   - hoặc Terminal:",
      "     cd thư-mục-này",
      "     chmod +x BatDau.command",
      "     xattr -cr .",
      "     ./BatDau.command",
      "3. BatDau.command:",
      "   - Đã có Node.js → chạy Agent ngay.",
      "   - Chưa có → tự tải Node portable vào .runtime (chỉ lần đầu, cần mạng).",
      "4. Giữ Terminal/Agent mở → web Cào dữ liệu.",
      "",
      "http://127.0.0.1:17890",
      "",
    ].join("\n"),
    "utf8"
  );
}

function copyIfExists(src, dest) {
  if (fs.existsSync(src)) fs.copyFileSync(src, dest);
}

function ensureCleanDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    // Thư mục đang mở Explorer / file lock — xóa từng file
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        try {
          fs.rmSync(path.join(dir, name), { recursive: true, force: true });
        } catch (e) {
          console.warn(`[build-scrape-agent] Không xóa được ${name}:`, e.message || e);
        }
      }
    }
  }
  fs.mkdirSync(dir, { recursive: true });
}

function zipDir(sourceDir, zipPath, onlyNames) {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  const names =
    onlyNames && onlyNames.length
      ? onlyNames
      : fs.readdirSync(sourceDir).filter((n) => !n.startsWith("."));
  const paths = names
    .map((n) => path.join(sourceDir, n))
    .filter((p) => fs.existsSync(p));
  if (!paths.length) throw new Error(`Không có file để zip trong ${sourceDir}`);
  const list = paths.map((p) => `'${p.replace(/'/g, "''")}'`).join(",");
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path @(${list}) -DestinationPath '${zipPath.replace(
      /'/g,
      "''"
    )}' -Force"`,
    { cwd: root, stdio: "inherit", shell: true }
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

  // Package Windows zip — chỉ agent.js + BatDau + hướng dẫn (không còn .exe)
  ensureCleanDir(outWinDir);
  copyIfExists(outfile, path.join(outWinDir, "agent.js"));
  writeWinSupport(outWinDir);

  // Package macOS zip — không còn binary pkg
  ensureCleanDir(outMacDir);
  copyIfExists(outfile, path.join(outMacDir, "agent.js"));
  writeMacSupport(outMacDir);

  const publicDir = path.join(root, "next", "public", "downloads");
  fs.mkdirSync(publicDir, { recursive: true });

  const zipWin = path.join(root, "release", "ShopeeScrapeAgent-windows.zip");
  const zipMac = path.join(root, "release", "ShopeeScrapeAgent-macos.zip");
  const zipLegacy = path.join(root, "release", "ShopeeScrapeAgent.zip");

  try {
    zipDir(outWinDir, zipWin, ["agent.js", "BatDau.bat", "HUONG-DAN.txt"]);
    fs.copyFileSync(zipWin, path.join(publicDir, "ShopeeScrapeAgent-windows.zip"));
    fs.copyFileSync(zipWin, path.join(publicDir, "ShopeeScrapeAgent.zip")); // legacy UI link
    fs.copyFileSync(zipWin, zipLegacy);
    console.log(`[build-scrape-agent] Windows zip → ${zipWin}`);
  } catch (err) {
    console.warn("[build-scrape-agent] Zip Windows thất bại:", err && err.message ? err.message : err);
  }

  try {
    zipDir(outMacDir, zipMac, ["agent.js", "BatDau.command", "HUONG-DAN-MAC.txt"]);
    fs.copyFileSync(zipMac, path.join(publicDir, "ShopeeScrapeAgent-macos.zip"));
    console.log(`[build-scrape-agent] macOS zip → ${zipMac}`);
  } catch (err) {
    console.warn("[build-scrape-agent] Zip macOS thất bại:", err && err.message ? err.message : err);
  }

  console.log("[build-scrape-agent] Xong (không còn binary pkg).");
  console.log(`  Windows: ${path.join(publicDir, "ShopeeScrapeAgent-windows.zip")}`);
  console.log(`  macOS:   ${path.join(publicDir, "ShopeeScrapeAgent-macos.zip")}`);
}

main();
