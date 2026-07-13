/**
 * Mở Chrome thường → tab Affiliate (phục vụ extension bridge).
 * Không dùng CDP / Playwright.
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs";

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

/** Mở tab Affiliate trên Chrome đang dùng (session thật). */
export async function openNormalChrome(options: {
  startUrl: string;
  onProgress?: (message: string) => void;
}): Promise<void> {
  const startUrl = options.startUrl;
  const chromePath = findChromeExecutable();

  options.onProgress?.("Đang mở trang Affiliate trên Chrome...");

  if (chromePath) {
    const child = spawn(chromePath, ["--new-tab", startUrl], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.unref();
    return;
  }

  if (process.platform === "win32") {
    const child = spawn("cmd", ["/c", "start", "", startUrl], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    return;
  }

  throw new Error(
    "Không tìm thấy Google Chrome. Cài Chrome hoặc set biến môi trường CHROME_PATH."
  );
}
