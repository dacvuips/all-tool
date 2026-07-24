#!/bin/bash
cd "$(dirname "$0")"
export SUPPRESS_NO_CONFIG_WARNING=1
echo
echo " === Shopee Scrape Agent (macOS) ==="
echo " Giữ cửa sổ này mở khi dùng tab Cào dữ liệu trên web."
echo " Thoát: Ctrl+C hoặc đóng cửa sổ."
echo
if [ -x "./ShopeeScrapeAgent-macos-arm64" ]; then
  exec ./ShopeeScrapeAgent-macos-arm64
fi
if [ -x "./ShopeeScrapeAgent-macos-x64" ]; then
  exec ./ShopeeScrapeAgent-macos-x64
fi
if command -v node >/dev/null 2>&1 && [ -f ./agent.js ]; then
  exec node agent.js
fi
echo "[Lỗi] Không tìm thấy binary macOS hoặc Node.js + agent.js"
read -r -p "Nhấn Enter để đóng..." _
exit 1
