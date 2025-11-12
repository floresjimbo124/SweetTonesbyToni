# Start server script
Write-Host ""
Write-Host "========================================"
Write-Host "  STARTING SWEETS TONES BY TONI SERVER"
Write-Host "========================================"
Write-Host ""

# Kill any running node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Wait a moment
Start-Sleep -Seconds 2

# Set location to script directory
Set-Location $PSScriptRoot

# Start the server
Write-Host "Starting server on port 3000..."
Write-Host "Press Ctrl+C to stop the server"
Write-Host ""

node server.js

