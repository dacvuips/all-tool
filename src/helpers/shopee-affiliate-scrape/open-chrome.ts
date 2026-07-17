/**
 * Mở Chrome thường → tab Affiliate (phục vụ extension bridge).
 * Không dùng CDP / Playwright.
 *
 * Best-effort: khi API chạy remote/Linux không có Chrome thì trả về false
 * để frontend tự window.open(offerUrl) trên máy user (nơi có extension).
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export function findChromeExecutable(): string | null {
  const envPath = process.env.CHROME_PATH || process.env.GOOGLE_CHROME_BIN;
  const candidates = [
    envPath,
    // Windows — đường dẫn tuyệt đối (không phụ thuộc env)
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
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
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
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

/**
 * Thử mở tab trên Chrome của máy chạy API.
 * @returns true nếu đã spawn được process; false nếu không có Chrome (frontend sẽ mở URL).
 */
export async function openNormalChrome(options: {
  startUrl: string;
  onProgress?: (message: string) => void;
}): Promise<boolean> {
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
    return true;
  }

  if (process.platform === "win32") {
    const child = spawn("cmd", ["/c", "start", "", startUrl], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    return true;
  }

  // Remote/Linux không có Chrome — không throw; client mở URL trên máy user.
  return false;
}
