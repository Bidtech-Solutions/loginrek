@echo off
setlocal
cd /d "%~dp0"
title Login Rek - Go Backend API (Port 3333)

echo ============================================================
echo   MENJALANKAN BACKEND GO + GIN + REST API
echo ============================================================
echo.

if exist api.exe goto run_api

if exist "C:\Program Files\Go\bin\go.exe" set "PATH=C:\Program Files\Go\bin;%PATH%"
where go >nul 2>nul
if not errorlevel 1 goto compile_go

echo [ERROR] Server api.exe belum dikompilasi dan Golang belum terpasang di komputer ini.
pause
exit /b 1

:run_api
echo [1/1] Menjalankan server Go api.exe di Port 3333...
echo ============================================================
echo   Endpoint API: http://localhost:3333/api/v1
echo   Health Check: http://localhost:3333/health
echo ============================================================
echo.
api.exe
goto finish

:compile_go
echo [1/1] Menjalankan kode sumber server Go di Port 3333...
echo ============================================================
echo   Endpoint API: http://localhost:3333/api/v1
echo   Health Check: http://localhost:3333/health
echo ============================================================
echo.
go run cmd/api/main.go

:finish
pause
