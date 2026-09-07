@echo off
REM ============================================================
REM  Opencode Provider Config Tool - Start Project (Windows)
REM  Double-click this file to install deps (if needed) and
REM  start the Next.js dev server on http://localhost:3000
REM  Usage:
REM    start.bat          - dev server (next dev)
REM    start.bat prod     - production (next build + next start)
REM ============================================================
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title Opencode Provider Config Tool

REM Always run from the folder containing this .bat
cd /d "%~dp0"

echo.
echo  ================================================
echo   Opencode Provider Config Tool - Starting...
echo  ================================================
echo.

REM --- 1. Check Node.js ---
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found in PATH.
    echo         Install Node.js 20 LTS from https://nodejs.org/ then re-run start.bat
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node %NODE_VER%

REM --- 2. Check npm ---
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found in PATH. Reinstall Node.js LTS.
    echo.
    pause
    exit /b 1
)

REM --- 3. Must be project root ---
if not exist "package.json" (
    echo [ERROR] package.json not found. Move start.bat to the project root next to package.json.
    echo.
    pause
    exit /b 1
)

REM --- 4. Setup .env from example if missing ---
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] .env not found - copying from .env.example...
        copy /y ".env.example" ".env" >nul
    )
)

REM --- 5. Install dependencies if needed ---
if not exist "node_modules" (
    echo [INFO] node_modules not found - running npm install, please wait...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed. Check errors above.
        echo.
        pause
        exit /b 1
    )
) else (
    echo [OK] Dependencies found, skipping npm install.
)

echo.
if /i "%~1"=="prod" goto :prod
if /i "%~1"=="production" goto :prod
if /i "%~1"=="build" goto :prod
goto :dev

:dev
echo [INFO] Starting dev server: npm run dev
echo [INFO] Open http://localhost:3000 in your browser.
echo [INFO] Press Ctrl+C to stop.
echo.
REM Open browser after short delay (non-blocking)
start "" /min powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:3000'" >nul 2>&1
call npm run dev
goto :end

:prod
echo [INFO] Building for production: npm run build
echo.
call npm run build
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed. Check errors above.
    echo.
    pause
    exit /b 1
)
echo.
echo [INFO] Starting production server: npm start
echo [INFO] Open http://localhost:3000 in your browser.
echo [INFO] Press Ctrl+C to stop.
echo.
start "" /min powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:3000'" >nul 2>&1
call npm start
goto :end

:end
echo.
echo  Server stopped (exit code %ERRORLEVEL%).
echo.
pause
endlocal
