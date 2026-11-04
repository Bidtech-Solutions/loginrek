@echo off
setlocal
cd /d "%~dp0"
title Login Rek - Launcher (Backend GO + Web + Mobile)

echo ============================================================
echo   LOGIN REK - LAUNCHER SISTEM LENGKAP (BACKEND GO)
echo   Stack: Go (api.exe) + Web Dashboard (Vite) + Mobile (Expo)
echo ============================================================
echo.

echo [1/3] Menjalankan Backend Go API (Port 3333)...
taskkill /F /IM api.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3333 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
if exist "%~dp0loginrek-backend-go\api.exe" (
    start "1. Backend Go (Port 3333)" /D "%~dp0loginrek-backend-go" cmd /k "api.exe"
) else (
    start "1. Backend Go (Port 3333)" /D "%~dp0loginrek-backend-go" cmd /k "go run cmd/api/main.go"
)

ping -n 3 127.0.0.1 >nul

echo [2/3] Menjalankan Web Dashboard Admin (Port 5173)...
start "2. Web Dashboard Admin (Port 5173)" /D "%~dp0loginrek-dashboard" cmd /k "npm run dev"

ping -n 3 127.0.0.1 >nul

echo [3/3] Menjalankan Aplikasi Mobile Expo (Mode LAN Wi-Fi)...
start "3. Aplikasi Mobile (LAN)" /D "%~dp0loginrek-mobile" cmd /k "npx expo start --lan -c"

echo.
echo ============================================================
echo   SEMUA SERVER SUDAH BERHASIL DINYALAKAN DENGAN BACKEND GO!
echo ============================================================
echo   - Web Dashboard Admin : http://localhost:5173
echo   - Backend Go REST API : http://localhost:3333/api/v1
echo   - Backend Healthcheck : http://localhost:3333/health
echo ============================================================
echo.
pause
