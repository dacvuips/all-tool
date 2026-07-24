@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
set SUPPRESS_NO_CONFIG_WARNING=1
set "NODE_VER=v22.16.0"
set "RUNTIME_DIR=%~dp0.runtime"
set "NODE_CMD="
echo.
echo  === Shopee Scrape Agent (Windows) ===
echo  Giữ cửa sổ này mở khi dùng tab Cào dữ liệu trên web.
echo  Thoát: Ctrl+C hoặc đóng cửa sổ.
echo.
if not exist "%~dp0agent.js" (
  echo [Loi] Thieu agent.js trong thu muc nay.
  pause
  exit /b 1
)

where node >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%i in ('where node') do (
    set "NODE_CMD=%%i"
    goto :have_node
  )
)

if exist "%RUNTIME_DIR%\node.exe" (
  set "NODE_CMD=%RUNTIME_DIR%\node.exe"
  goto :have_node
)

echo [Thong bao] Chua co Node.js - dang tai ban portable (chi lan dau)...
call :install_portable_node
if errorlevel 1 (
  echo [Loi] Khong cai duoc Node.js. Thu cai tay tai https://nodejs.org roi chay lai BatDau.bat
  pause
  exit /b 1
)
set "NODE_CMD=%RUNTIME_DIR%\node.exe"

:have_node
echo  Dung Node: %NODE_CMD%
echo.
"%NODE_CMD%" "%~dp0agent.js"
set "EXITCODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXITCODE%

:install_portable_node
set "ZIP=%TEMP%\node-%NODE_VER%-win-x64.zip"
set "URL=https://nodejs.org/dist/%NODE_VER%/node-%NODE_VER%-win-x64.zip"
set "EXTRACT=%TEMP%\node-%NODE_VER%-extract"
if exist "%EXTRACT%" rmdir /s /q "%EXTRACT%" 2>nul
echo  URL: %URL%
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop'; " ^
  "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; " ^
  "Invoke-WebRequest -Uri $env:URL -OutFile $env:ZIP; " ^
  "if (Test-Path $env:EXTRACT) { Remove-Item -Recurse -Force $env:EXTRACT }; " ^
  "Expand-Archive -Path $env:ZIP -DestinationPath $env:EXTRACT -Force"
if errorlevel 1 exit /b 1
if not exist "%EXTRACT%\node-%NODE_VER%-win-x64\node.exe" (
  echo [Loi] Giai nen Node that bai.
  exit /b 1
)
if exist "%RUNTIME_DIR%" rmdir /s /q "%RUNTIME_DIR%" 2>nul
mkdir "%RUNTIME_DIR%" >nul 2>&1
xcopy /e /i /y /q "%EXTRACT%\node-%NODE_VER%-win-x64\*" "%RUNTIME_DIR%\" >nul
if not exist "%RUNTIME_DIR%\node.exe" (
  echo [Loi] Khong copy duoc node.exe vao .runtime
  exit /b 1
)
echo  Da cai Node portable vao .runtime\
exit /b 0
