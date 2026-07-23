/**
 * Mở Chrome với CDP (--remote-debugging-port) + profile riêng (giữ login Affiliate).
 */

import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import http from "http";

export const DEFAULT_CDP_PORT = Number(process.env.SHOPEE_AFFILIATE_CDP_PORT) || 9222;

export function findChromeExecutable(): string | null {
  const envPath = process.env.CHROME_PATH || process.env.GOOGLE_CHROME_BIN;
  const candidates = [
    envPath,
    path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(
      process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)",
      "Google",
      "Chrome",
      "Application",
      "chrome.exe"
    ),
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  return null;
}

export function getCdpUserDataDir(): string {
  const envDir = process.env.SHOPEE_AFFILIATE_CDP_USER_DATA_DIR;
  if (envDir && envDir.trim()) return path.resolve(envDir.trim());
  return path.join(os.homedir(), ".viet-theo", "chrome-affiliate-cdp");
}

export function getCdpEndpoint(port = DEFAULT_CDP_PORT): string {
  return `http://127.0.0.1:${port}`;
}

/** Kiểm tra CDP endpoint đã sẵn sàng chưa. */
export function probeCdpEndpoint(port = DEFAULT_CDP_PORT, timeoutMs = 1500): Promise<boolean> {
  const endpoint = getCdpEndpoint(port);
  return new Promise((resolve) => {
    const req = http.get(`${endpoint}/json/version`, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

let launchedChild: ChildProcess | null = null;

/**
 * Launch Chrome CDP nếu chưa có endpoint. Trả về port đang dùng.
 */
export async function ensureChromeCdp(options: {
  startUrl: string;
  port?: number;
  onProgress?: (message: string) => void;
}): Promise<{ port: number; launched: boolean; endpoint: string }> {
  const port = options.port || DEFAULT_CDP_PORT;
  const endpoint = getCdpEndpoint(port);

  if (await probeCdpEndpoint(port)) {
    options.onProgress?.("Đã kết nối Chrome CDP đang chạy...");
    return { port, launched: false, endpoint };
  }

  const chromePath = findChromeExecutable();
  if (!chromePath) {
    throw new Error(
      "Không tìm thấy Google Chrome. Cài Chrome hoặc set biến môi trường CHROME_PATH."
    );
  }

  const userDataDir = getCdpUserDataDir();
  fs.mkdirSync(userDataDir, { recursive: true });

  options.onProgress?.(`Đang mở Chrome CDP (port ${port})...`);

  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-popup-blocking",
    options.startUrl,
  ];

  const child = spawn(chromePath, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
  launchedChild = child;

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await probeCdpEndpoint(port, 800)) {
      return { port, launched: true, endpoint };
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  throw new Error(
    `Chrome đã spawn nhưng CDP port ${port} chưa sẵn sàng. Đóng Chrome profile Viet-Theo rồi thử lại.`
  );
}

/** @deprecated Dùng ensureChromeCdp — giữ để tương thích tạm. */
export async function openNormalChrome(options: {
  startUrl: string;
  onProgress?: (message: string) => void;
}): Promise<void> {
  await ensureChromeCdp(options);
}

export function getLaunchedChromeChild(): ChildProcess | null {
  return launchedChild;
}
