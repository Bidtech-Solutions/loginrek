@echo off
setlocal
cd /d "%~dp0"
title Restart Semua Sistem Login Rek

echo ============================================================
echo   RESTART BERSIH SEMUA SISTEM LOGIN REK
echo ============================================================
echo.

echo [1/4] Menghentikan semua server lama yang nyangkut...
taskkill /F /IM api.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3333 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8081 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

ping -n 2 127.0.0.1 >nul

echo [2/4] Menjalankan Backend Go API (Port 3333)...
start "1. Backend Go (Port 3333)" /D "%~dp0loginrek-backend-go" cmd /k "api.exe"

ping -n 3 127.0.0.1 >nul

echo [3/4] Menjalankan Web Dashboard Admin (Port 5173)...
start "2. Web Dashboard Admin (Port 5173)" /D "%~dp0loginrek-dashboard" cmd /k "npm run dev"

ping -n 3 127.0.0.1 >nul

echo [4/4] Menjalankan Aplikasi Mobile Expo (Mode LAN Wi-Fi)...
start "3. Aplikasi Mobile (LAN)" /D "%~dp0loginrek-mobile" cmd /k "npx expo start --lan -c"

echo.
echo ============================================================
echo   SEMUA 3 SERVER SUDAH BERHASIL DI-RESTART BERSIH!
echo ============================================================
echo   - Backend Go API   : http://localhost:3333 (Port 3333 AKTIF)
echo   - Web Dashboard    : http://localhost:5173 (Port 5173 AKTIF)
echo   - Mobile Expo LAN  : Port 8081 AKTIF
echo ============================================================
echo.
pause

