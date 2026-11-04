@echo off
title Build Standalone APK Android (Loginrek)
echo ============================================================
echo   PROSES BUILD FILE APK ANDROID (STANDALONE INSTALLER)
echo ============================================================
echo.
echo Aplikasi akan di-build menjadi file .apk mandiri melalui cloud.
echo.
echo Kelebihan File APK:
echo - Bisa langsung diinstall di SEMUA HP Android (termasuk hp orang lain)
echo - Bisa dikirim lewat WhatsApp atau Google Drive
echo - Kamera Selfie dan Lokasi GPS aktif 100%% native
echo - TIDAK BUTUH aplikasi Expo Go dan TIDAK PERLU login akun apapun selamanya!
echo.
echo ============================================================
echo Memulai proses build ke cloud...
echo ============================================================
cd /d "%~dp0loginrek-mobile"
call npx eas build -p android --profile preview
echo.
echo ============================================================
echo PROSES BUILD SELESAI / SELESAI DIPROSES!
echo ============================================================
echo Tekan tombol apa saja untuk menutup jendela ini...
pause >nul
