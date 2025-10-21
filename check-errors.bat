@echo off
REM Error Log Checker - Double-click to run
echo Running error log checker...
powershell -ExecutionPolicy Bypass -File "%~dp0check-errors.ps1"
pause

