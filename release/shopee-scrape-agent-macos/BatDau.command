#!/bin/bash
cd "$(dirname "$0")"
export SUPPRESS_NO_CONFIG_WARNING=1
echo
echo " === Shopee Scrape Agent (macOS) ==="
echo " Giữ cửa sổ này mở khi dùng tab Cào dữ liệu trên web."
echo " Thoát: Ctrl+C hoặc đóng cửa sổ."
echo
ARCH=$(uname -m)
BIN=""
if [ "$ARCH" = "arm64" ] && [ -x "./ShopeeScrapeAgent-macos-arm64" ]; then
  BIN="./ShopeeScrapeAgent-macos-arm64"
elif [ -x "./ShopeeScrapeAgent-macos-x64" ]; then
  BIN="./ShopeeScrapeAgent-macos-x64"
elif [ -x "./ShopeeScrapeAgent-macos-arm64" ]; then
  BIN="./ShopeeScrapeAgent-macos-arm64"
fi
if [ -n "$BIN" ]; then
  exec "$BIN"
fi
if command -v node >/dev/null 2>&1 && [ -f ./agent.js ]; then
  exec node agent.js
fi
echo "[Lỗi] Không tìm thấy binary macOS hoặc Node.js + agent.js"
read -r -p "Nhấn Enter để đóng..." _
exit 1
