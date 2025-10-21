@echo off
echo.
echo ========================================
echo   STARTING SWEETS TONES BY TONI SERVER
echo   Secure Static File Serving Enabled
echo ========================================
echo.

REM Kill any running node processes
taskkill /F /IM node.exe >nul 2>&1

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Start the server
node server.js

pause

