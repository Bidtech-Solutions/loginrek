@echo off
setlocal
title Matikan Windows Firewall Sementara untuk Testing HP Android

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Membutuhkan izin Administrator...
    echo Silakan klik "YES" pada pop-up Windows yang muncul.
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo Mematikan Windows Defender Firewall sementara untuk testing HP Android...
netsh advfirewall set allprofiles state off
echo.
echo ============================================================
echo   SUKSES! WINDOWS FIREWALL TELAH DIMATIKAN SEMENTARA!
echo ============================================================
echo   Semua blokir koneksi dari HP Android ke laptop telah DIBUKA.
echo   Sekarang HP Android dijamin 100%% bisa terhubung ke laptop!
echo ============================================================
echo.
echo Jika pengujian sudah selesai di kemudian hari, Anda bisa
echo menjalankan file "HIDUPKAN_FIREWALL.bat" untuk mengaktifkannya lagi.
echo.
pause

