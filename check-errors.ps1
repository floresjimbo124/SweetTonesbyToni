# 🔍 Error Log Checker for Sweets by Toni
# Run this script to quickly check for errors

Write-Host "🍰 Sweets by Toni - Error Log Checker" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host ""

$today = Get-Date -Format yyyy-MM-dd
$errorLogToday = "logs\error-$today.log"

# Check if logs directory exists
if (-Not (Test-Path "logs")) {
    Write-Host "⚠️  No logs directory found. Server may not have started yet." -ForegroundColor Yellow
    exit
}

# Check today's error log
if (Test-Path $errorLogToday) {
    $errorCount = (Get-Content $errorLogToday | Measure-Object -Line).Lines
    
    if ($errorCount -eq 0) {
        Write-Host "✅ No errors today! ($today)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Found $errorCount error line(s) today ($today):" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Recent errors:" -ForegroundColor Red
        Write-Host "-" * 50 -ForegroundColor Gray
        Get-Content $errorLogToday -Tail 10
        Write-Host "-" * 50 -ForegroundColor Gray
        Write-Host ""
        Write-Host "💡 To view all errors: Get-Content $errorLogToday" -ForegroundColor Cyan
    }
} else {
    Write-Host "✅ No error log file for today - no errors recorded!" -ForegroundColor Green
}

Write-Host ""

# Check for errors in the last 7 days
Write-Host "📊 Error Summary (Last 7 Days):" -ForegroundColor Cyan
Write-Host "-" * 50 -ForegroundColor Gray

$totalErrors = 0
for ($i = 0; $i -lt 7; $i++) {
    $date = (Get-Date).AddDays(-$i).ToString("yyyy-MM-dd")
    $logFile = "logs\error-$date.log"
    
    if (Test-Path $logFile) {
        $count = (Get-Content $logFile | Measure-Object -Line).Lines
        $totalErrors += $count
        
        if ($count -gt 0) {
            Write-Host "$date : $count error(s)" -ForegroundColor Yellow
        } else {
            Write-Host "$date : No errors" -ForegroundColor Green
        }
    }
}

Write-Host "-" * 50 -ForegroundColor Gray
Write-Host "Total errors in last 7 days: $totalErrors" -ForegroundColor $(if ($totalErrors -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

# Check disk space for logs
$logsSize = (Get-ChildItem logs -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "💾 Logs directory size: $([math]::Round($logsSize, 2)) MB" -ForegroundColor Cyan

Write-Host ""
Write-Host "✅ Check complete!" -ForegroundColor Green

