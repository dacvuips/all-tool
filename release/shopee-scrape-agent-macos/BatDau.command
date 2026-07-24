#!/bin/bash
cd "$(dirname "$0")"
export SUPPRESS_NO_CONFIG_WARNING=1
NODE_VER="v22.16.0"
RUNTIME_DIR="$(pwd)/.runtime"
echo
echo " === Shopee Scrape Agent (macOS) ==="
echo " Giữ cửa sổ này mở khi dùng tab Cào dữ liệu trên web."
echo " Thoát: Ctrl+C hoặc đóng cửa sổ."
echo
if [ ! -f ./agent.js ]; then
  echo "[Lỗi] Thiếu agent.js trong thư mục này."
  read -r -p "Nhấn Enter để đóng..." _
  exit 1
fi

resolve_node() {
  if command -v node >/dev/null 2>&1; then
    NODE_CMD=$(command -v node)
    return 0
  fi
  if [ -x "$RUNTIME_DIR/bin/node" ]; then
    NODE_CMD="$RUNTIME_DIR/bin/node"
    return 0
  fi
  return 1
}

install_portable_node() {
  echo "[Thông báo] Chưa có Node.js — đang tải bản portable (chỉ lần đầu)..."
  ARCH=$(uname -m)
  if [ "$ARCH" = "arm64" ]; then
    PLAT="darwin-arm64"
  else
    PLAT="darwin-x64"
  fi
  TGZ="/tmp/node-${NODE_VER}-${PLAT}.tar.gz"
  URL="https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-${PLAT}.tar.gz"
  echo " URL: $URL"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$URL" -o "$TGZ" || return 1
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$TGZ" "$URL" || return 1
  else
    echo "[Lỗi] Cần curl hoặc wget để tải Node."
    return 1
  fi
  rm -rf "$RUNTIME_DIR"
  mkdir -p "$RUNTIME_DIR"
  tar -xzf "$TGZ" -C "$RUNTIME_DIR" --strip-components=1 || return 1
  if [ ! -x "$RUNTIME_DIR/bin/node" ]; then
    echo "[Lỗi] Giải nén Node thất bại."
    return 1
  fi
  echo " Đã cài Node portable vào .runtime/"
  return 0
}

if ! resolve_node; then
  if ! install_portable_node; then
    echo "[Lỗi] Không cài được Node.js. Cài tay tại https://nodejs.org rồi chạy lại."
    read -r -p "Nhấn Enter để đóng..." _
    exit 1
  fi
  NODE_CMD="$RUNTIME_DIR/bin/node"
fi

echo " Dùng Node: $NODE_CMD"
echo
exec "$NODE_CMD" ./agent.js
