# 📝 Logging System Documentation

## Overview

The application uses **Winston** for application logging and **Morgan** for HTTP request logging, providing comprehensive, persistent logs for production debugging and monitoring.

## Log Files

All logs are stored in the `logs/` directory and are automatically rotated daily:

### Error Logs
- **Location:** `logs/error-YYYY-MM-DD.log`
- **Content:** Only error-level messages and exceptions
- **Retention:** 30 days
- **Max Size:** 20 MB per file
- **Format:** Includes stack traces for errors

### Combined Logs
- **Location:** `logs/combined-YYYY-MM-DD.log`
- **Content:** All application logs (info, warn, error)
- **Retention:** 14 days
- **Max Size:** 20 MB per file
- **Format:** Structured with timestamps

### HTTP Request Logs
- **Included in:** Combined logs
- **Content:** HTTP requests and responses
- **Format:** 
  - Production: Apache combined format
  - Development: Colorized dev format

## Log Levels

The logger supports multiple levels (controlled by `LOG_LEVEL` environment variable):

- `error` - Error messages and exceptions (default minimum)
- `warn` - Warning messages
- `info` - Informational messages
- `debug` - Debugging messages (set `LOG_LEVEL=debug` for verbose logging)

**Default:** `info`

## Log Format

```
YYYY-MM-DD HH:mm:ss [LEVEL]: message
```

Example:
```
2025-10-21 14:32:15 [INFO]: 🍰 Sweets by Toni Server running on http://localhost:3000
2025-10-21 14:35:22 [ERROR]: Database error: SQLITE_BUSY: database is locked
```

## Features

### Automatic Rotation
- Logs rotate daily at midnight
- Old logs are automatically compressed (.gz)
- Old logs are deleted based on retention policy

### Unhandled Exceptions
- Automatically logged before application crashes
- Includes full stack trace
- Gives logger time to write before exit

### Unhandled Promise Rejections
- Logged with promise details and reason
- Helps identify async/await issues

### Console Output
- Development: Colorized, readable format
- Production: Also outputs to console for container logs (Docker, etc.)

## Configuration

Set the log level via environment variable:

```bash
# Default (info and above)
LOG_LEVEL=info

# Verbose debugging
LOG_LEVEL=debug

# Errors only
LOG_LEVEL=error
```

## Usage in Code

The logger is already integrated throughout the application. If you need to add logging:

```javascript
const logger = require('./logger');

// Info messages
logger.info('User registered successfully');

// Warnings
logger.warn('Low stock detected for product XYZ');

// Errors (with stack trace)
logger.error('Database connection failed:', error);

// Debug (only shown when LOG_LEVEL=debug)
logger.debug('Cache hit for key: user-123');
```

## Monitoring Logs

### View Recent Errors
```powershell
# Windows PowerShell
Get-Content logs\error-2025-10-21.log -Tail 50

# Or use type
type logs\error-2025-10-21.log
```

```bash
# Linux/Mac
tail -f logs/error-$(date +%Y-%m-%d).log
```

### View All Logs
```powershell
# Windows PowerShell
Get-Content logs\combined-2025-10-21.log -Tail 100

# Follow in real-time
Get-Content logs\combined-2025-10-21.log -Wait -Tail 50
```

```bash
# Linux/Mac
tail -f logs/combined-$(date +%Y-%m-%d).log
```

### Search Logs
```powershell
# Windows PowerShell - Search for specific errors
Select-String -Path "logs\*.log" -Pattern "Database error"

# Search in specific date
Select-String -Path "logs\combined-2025-10-21.log" -Pattern "Order"
```

```bash
# Linux/Mac
grep "Database error" logs/*.log
grep "Order" logs/combined-2025-10-21.log
```

## What Gets Logged

### Application Events
- ✅ Server startup/shutdown
- ✅ Database connections
- ✅ Email service initialization
- ✅ Backup operations
- ✅ Admin authentication
- ✅ Order submissions
- ✅ CORS violations
- ✅ Configuration warnings

### HTTP Requests
- ✅ All API requests
- ✅ Response status codes
- ✅ Response times
- ✅ Request method and path
- ✅ User agent (in production)

### Errors
- ✅ Database errors
- ✅ File upload errors
- ✅ Email sending failures
- ✅ Authentication failures
- ✅ Validation errors
- ✅ Unhandled exceptions
- ✅ Unhandled promise rejections

## Disk Space Management

### Log Sizes
- Compressed logs: ~100-500 KB per day
- Uncompressed logs: ~1-5 MB per day
- Total storage (30 days errors + 14 days combined): ~50-200 MB

### Cleanup
Automatic cleanup happens based on retention policy:
- Error logs: Deleted after 30 days
- Combined logs: Deleted after 14 days
- Logs are compressed (.gz) to save space

### Manual Cleanup
If needed, you can manually delete old logs:

```powershell
# Windows PowerShell - Delete logs older than 30 days
Get-ChildItem logs -Recurse -File | 
  Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-30)} | 
  Remove-Item
```

```bash
# Linux/Mac - Delete logs older than 30 days
find logs -type f -mtime +30 -delete
```

## Troubleshooting

### No logs appearing?
1. Check the `logs/` directory exists (auto-created on startup)
2. Check file permissions
3. Verify `LOG_LEVEL` is set appropriately
4. Check console output for startup errors

### Logs too verbose?
Set `LOG_LEVEL=warn` or `LOG_LEVEL=error`

### Need more detail?
Set `LOG_LEVEL=debug` temporarily

### Logs taking too much space?
- Reduce retention period in `logger.js`
- Lower the `maxFiles` values
- Compress old logs manually

## Production Best Practices

1. **Set appropriate log level** - Use `info` or `warn` in production
2. **Monitor error logs daily** - Check for recurring issues
3. **Set up log alerts** - Use monitoring tools to alert on errors
4. **Backup logs** - Include logs in your backup strategy (optional)
5. **Review regularly** - Weekly review of patterns and issues
6. **Disk monitoring** - Ensure sufficient disk space for logs

## Integration with Monitoring Tools

The structured log format works well with:
- **LogStash** - For log aggregation
- **Grafana Loki** - For log visualization
- **Datadog** - For monitoring and alerting
- **CloudWatch** - For AWS deployments
- **Azure Monitor** - For Azure deployments

## Environment-Specific Behavior

### Development
- Colorized console output
- `dev` format for HTTP logs (concise, colored)
- All logs to console and files

### Production
- Standard console output
- `combined` format for HTTP logs (detailed, Apache-style)
- All logs to files, summary to console

---

**Note:** The `logs/` directory is excluded from Git (`.gitignore`) to prevent committing potentially sensitive log data.

