@echo off
setlocal
title Hidupkan Kembali Windows Firewall

net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

netsh advfirewall set allprofiles state on
echo.
echo ============================================================
echo   WINDOWS FIREWALL TELAH BERHASIL DIHIDUPKAN KEMBALI!
echo ============================================================
echo.
pause

