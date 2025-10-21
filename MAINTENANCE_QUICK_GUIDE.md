# 🛠️ Daily Maintenance Quick Guide

Quick reference for checking your bakery website's health.

---

## 📋 Daily Checklist (5 minutes)

### 1️⃣ Check for New Orders
**Method 1 - Admin Dashboard:**
- Go to `yourdomain.com/admin.html`
- Log in
- Check the orders table

**Method 2 - Database:**
```powershell
# Count today's orders
sqlite3 orders.db "SELECT COUNT(*) FROM orders WHERE date(created_at) = date('now');"
```

### 2️⃣ Check for Errors
**Method 1 - Easy Way (Recommended):**

**Just double-click:** `check-errors.bat`

This will show you:
- ✅ Number of errors today
- 📊 Error summary for last 7 days  
- 💾 Logs disk usage
- 🔍 Recent error details (if any)

**Method 2 - Manual PowerShell:**
```powershell
# Open PowerShell in project folder and run:
.\check-errors.ps1

# Or manually check today's errors:
Get-Content logs\error-$(Get-Date -Format yyyy-MM-dd).log
```

### 3️⃣ Check Disk Space
**Quick Check:**
```powershell
# Check uploads folder size
(Get-ChildItem uploads -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB

# Check logs folder size
(Get-ChildItem logs -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB

# Check backups folder size
(Get-ChildItem backups -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
```

Or just look at folder properties in Windows Explorer.

---

## 📊 Weekly Tasks (15 minutes)

### 1️⃣ Review Backup Logs
Check that backups are running:
```powershell
# List recent backups
Get-ChildItem backups\*.db | Sort-Object LastWriteTime -Descending | Select-Object -First 7
```

### 2️⃣ Review Error Patterns
Look for recurring errors:
```powershell
# Find most common errors
Select-String -Path "logs\error-*.log" -Pattern "\[ERROR\]" | 
  Group-Object Pattern | 
  Sort-Object Count -Descending | 
  Select-Object -First 10
```

### 3️⃣ Check Email Delivery
If you have emails configured:
```powershell
# Search for email errors
Select-String -Path "logs\combined-*.log" -Pattern "email.*sent|email.*failed"
```

---

## 🚨 Common Error Types & Solutions

### Database Errors
**Symptom:** `SQLITE_BUSY: database is locked`
**Solution:**
- Usually resolves itself
- If persistent, restart the server
- Check for multiple server instances running

### Email Errors
**Symptom:** `Failed to send confirmation email`
**Solution:**
- Check EMAIL_CONFIG in `.env`
- Verify SendGrid API key is valid
- Check email service status

### File Upload Errors
**Symptom:** `File upload error`
**Solution:**
- Check `uploads/` folder permissions
- Verify disk space available
- Check file size limits (currently 5MB)

### CORS Errors
**Symptom:** `Blocked CORS request from unauthorized origin`
**Solution:**
- Check `ALLOWED_ORIGINS` environment variable
- Add the domain to allowed origins
- Verify domain spelling

---

## 🔍 Useful Commands Reference

### View Logs
```powershell
# Today's errors
Get-Content logs\error-$(Get-Date -Format yyyy-MM-dd).log

# Today's all activity
Get-Content logs\combined-$(Get-Date -Format yyyy-MM-dd).log

# Follow logs in real-time
Get-Content logs\combined-$(Get-Date -Format yyyy-MM-dd).log -Wait -Tail 50

# Last 50 lines from any log
Get-Content logs\combined-$(Get-Date -Format yyyy-MM-dd).log -Tail 50
```

### Search Logs
```powershell
# Search for specific text
Select-String -Path "logs\*.log" -Pattern "order" -Context 1,1

# Search for errors only
Select-String -Path "logs\error-*.log" -Pattern "database"

# Count occurrences
(Select-String -Path "logs\*.log" -Pattern "error").Count
```

### Database Queries
```powershell
# Count total orders
sqlite3 orders.db "SELECT COUNT(*) FROM orders;"

# Today's orders
sqlite3 orders.db "SELECT * FROM orders WHERE date(created_at) = date('now');"

# Orders by status
sqlite3 orders.db "SELECT status, COUNT(*) FROM orders GROUP BY status;"

# Recent orders
sqlite3 orders.db "SELECT id, customer_name, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT 10;"
```

### Backup Management
```powershell
# List backups by date
Get-ChildItem backups\*.db | 
  Sort-Object LastWriteTime -Descending | 
  Format-Table Name, Length, LastWriteTime

# Check backup size
(Get-ChildItem backups -Recurse | Measure-Object -Property Length -Sum).Sum / 1GB
```

---

## 📈 Health Indicators

### ✅ Healthy System
- No error logs today (or very few)
- Backups running daily
- Orders processing successfully
- Logs under 100MB total
- Uploads folder growing normally

### ⚠️ Needs Attention
- 5-10 errors per day
- Missing a backup day
- Slow response times in logs
- Logs over 200MB
- Disk space below 20%

### 🚨 Critical Issues
- 50+ errors per day
- No backups for 3+ days
- Database locked errors
- Out of disk space
- Server not responding

---

## 🆘 Emergency Procedures

### If Server Won't Start
```powershell
# 1. Check for errors
Get-Content logs\error-$(Get-Date -Format yyyy-MM-dd).log -Tail 20

# 2. Check if port is in use
netstat -ano | findstr :3000

# 3. Restart server
.\start-server.bat
```

### If Database Corrupted
```powershell
# 1. Stop server (Ctrl+C)

# 2. Restore from latest backup
Copy-Item backups\orders-backup-LATEST.db orders.db -Force

# 3. Restart server
.\start-server.bat
```

### If Emails Not Sending
```powershell
# Check email configuration in logs
Select-String -Path "logs\combined-$(Get-Date -Format yyyy-MM-dd).log" -Pattern "email.*configured"

# Test email settings in .env file
```

---

## 📅 Recommended Schedule

**Every Morning (5 min):**
- Double-click `check-errors.bat`
- Check admin dashboard for new orders

**Monday (15 min):**
- Review error patterns
- Check backup integrity
- Review disk space

**Monthly (30 min):**
- Export orders to Excel
- Archive old payment proofs (optional)
- Update available dates for next month
- Review and update product limits if needed

---

## 💡 Pro Tips

1. **Set up Windows Task Scheduler** to email you the error check results daily
2. **Create desktop shortcuts** to `check-errors.bat` for quick access
3. **Bookmark your admin panel** for easy access
4. **Keep a log** of any manual changes you make (in a notepad)
5. **Test backups** by restoring to a test database once a month

---

## 📞 Quick Help

**Need to see what's happening right now?**
```powershell
Get-Content logs\combined-$(Get-Date -Format yyyy-MM-dd).log -Wait -Tail 20
```

**Need to find a specific order?**
```powershell
sqlite3 orders.db "SELECT * FROM orders WHERE customer_name LIKE '%John%';"
```

**Need to check server status?**
```powershell
# Check if server is running
netstat -ano | findstr :3000
```

---

**Remember:** Most days you should see ✅ **No errors!** If you see errors regularly, investigate the patterns to fix the root cause.

Good luck! 🍰

