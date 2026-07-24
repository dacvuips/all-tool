@echo off
chcp 65001 >nul
cd /d "%~dp0"
set SUPPRESS_NO_CONFIG_WARNING=1
echo.
echo  === Shopee Scrape Agent (Windows) ===
echo  Giữ cửa sổ này mở khi dùng tab Cào dữ liệu trên web.
echo  Thoát: Ctrl+C hoặc đóng cửa sổ.
echo.
if exist ShopeeScrapeAgent.exe (
  ShopeeScrapeAgent.exe
) else if exist agent.js (
  where node >nul 2>&1
  if errorlevel 1 (
    echo [Loi] Thieu ShopeeScrapeAgent.exe va khong tim thay Node.js.
    pause
    exit /b 1
  )
  node agent.js
) else (
  echo [Loi] Khong tim thay ShopeeScrapeAgent.exe / agent.js
  pause
  exit /b 1
)
pause
