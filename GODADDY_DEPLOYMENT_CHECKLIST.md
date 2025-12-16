# 🚀 GoDaddy Deployment Checklist

## ✅ Overall Status: READY FOR DEPLOYMENT

Your website is **functionally complete** and **all critical security issues are resolved**! Follow this checklist for GoDaddy deployment.

---

## 📋 Pre-Deployment Checklist

### ✅ Code Readiness
- [x] All critical security issues resolved (CORS, cookies, static file serving, database backups)
- [x] All API endpoints use relative paths (will work automatically on any domain)
- [x] Hardcoded localhost URLs fixed in email templates (now uses BASE_URL environment variable)
- [x] Database migration system in place
- [x] Logging system configured
- [x] Backup system automated

### 🔧 GoDaddy-Specific Requirements

#### 1. **Node.js Hosting Type**
GoDaddy offers different hosting options. You need:
- ✅ **Shared Hosting with Node.js support** OR
- ✅ **GoDaddy VPS (Virtual Private Server)** OR  
- ✅ **GoDaddy Managed WordPress Hosting** (won't work for Node.js apps)

**⚠️ Important:** Standard shared hosting may NOT support Node.js. You may need:
- VPS hosting, OR
- Consider alternative platforms (see alternatives below)

#### 2. **SSH Access**
- [ ] Verify SSH access is enabled in your GoDaddy hosting account
- [ ] Test SSH connection: `ssh username@yourdomain.com`

#### 3. **Node.js Installation**
- [ ] Check if Node.js is pre-installed: `node --version`
- [ ] If not installed, you'll need to install Node.js manually or contact GoDaddy support
- [ ] Recommended Node.js version: **14.0.0 or higher** (your app requires >=14.0.0)

#### 4. **SSL Certificate**
- [ ] SSL certificate enabled (required for production - secure cookies need HTTPS)
- [ ] Verify HTTPS is working: `https://yourdomain.com`

---

## 🔐 Environment Variables Setup

**CRITICAL:** These MUST be set before deployment. GoDaddy typically allows setting environment variables through:
- cPanel → Environment Variables section, OR
- `.env` file in your application root (if supported), OR
- SSH terminal export commands

### Required Environment Variables:

```bash
# CRITICAL - Security Settings
NODE_ENV=production
ADMIN_USERNAME=your-secure-admin-username-here
ADMIN_PASSWORD=your-very-strong-password-here
JWT_SECRET=generate-a-long-random-string-minimum-32-characters

# Base URL (REQUIRED for email templates)
BASE_URL=https://yourdomain.com

# CORS Settings (REQUIRED)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Port (GoDaddy may assign a specific port)
PORT=3000
# OR use the port GoDaddy provides (check their documentation)

# Email Configuration (Optional but Recommended)
# Option 1: SendGrid (Recommended)
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=sweettonesbytoni@gmail.com
SENDGRID_FROM_NAME=Sweets Tones by Toni

# Option 2: Gmail/Outlook (Alternative)
# EMAIL_SERVICE=gmail
# EMAIL_USER=sweettonesbytoni@gmail.com
# EMAIL_PASSWORD=your-gmail-app-password
# EMAIL_FROM=Sweets Tones by Toni <sweettonesbytoni@gmail.com>
```

### How to Generate JWT_SECRET:
```bash
# On your local machine or via SSH:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📦 Deployment Steps

### Step 1: Prepare Your Files
1. [ ] Create a backup of your entire project
2. [ ] Remove `node_modules` folder (will be reinstalled on server)
3. [ ] Ensure `.env` is NOT committed (should be in `.gitignore`)
4. [ ] Create `.gitignore` if it doesn't exist (should ignore `node_modules`, `.env`, `*.log`, `backups/`, `uploads/`)

### Step 2: Upload Files to GoDaddy
1. [ ] Upload all project files to your GoDaddy server (via FTP/SFTP or File Manager)
2. [ ] Recommended directory: `/public_html/` or `/home/username/app/` (check GoDaddy docs)

### Step 3: Install Dependencies
```bash
# SSH into your server
ssh username@yourdomain.com

# Navigate to your application directory
cd /path/to/your/app

# Install production dependencies
npm install --production
```

### Step 4: Set Environment Variables
```bash
# Via SSH (temporary - for testing)
export NODE_ENV=production
export BASE_URL=https://yourdomain.com
export ADMIN_USERNAME=your-secure-admin-username
export ADMIN_PASSWORD=your-very-strong-password
export JWT_SECRET=your-generated-jwt-secret
export ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# OR create a .env file (if supported)
nano .env
# Paste all environment variables
# Save and exit (Ctrl+X, then Y, then Enter)
```

**⚠️ Important:** For permanent environment variables, use:
- cPanel → Environment Variables, OR
- GoDaddy's environment variable configuration panel

### Step 5: Start Your Application

#### Option A: Manual Start (Testing)
```bash
npm start
```

#### Option B: Using PM2 (Recommended for Production)
```bash
# Install PM2 globally
npm install -g pm2

# Start your app with PM2
pm2 start server.js --name "sweets-by-toni"

# Save PM2 configuration
pm2 save

# Setup PM2 to start on server reboot
pm2 startup
```

#### Option C: Using systemd (Linux VPS)
Create a systemd service file (if you have root access):
```bash
sudo nano /etc/systemd/system/sweets-by-toni.service
```

Service file content:
```ini
[Unit]
Description=Sweets by Toni Node.js App
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/your/app
Environment=NODE_ENV=production
Environment=BASE_URL=https://yourdomain.com
# Add all other environment variables here
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then enable and start:
```bash
sudo systemctl enable sweets-by-toni
sudo systemctl start sweets-by-toni
```

### Step 6: Configure Reverse Proxy (If Needed)
If GoDaddy requires a reverse proxy setup, you may need to configure:
- Apache `.htaccess` file, OR
- Nginx configuration

Check GoDaddy documentation for Node.js reverse proxy setup.

---

## 🧪 Post-Deployment Testing

### 1. Basic Functionality
- [ ] Website loads at `https://yourdomain.com`
- [ ] Products display correctly
- [ ] Shopping cart works
- [ ] Can add items to cart
- [ ] Can proceed to checkout

### 2. Order Submission
- [ ] Can submit a test order
- [ ] Payment proof upload works
- [ ] Order confirmation appears
- [ ] Order saved to database
- [ ] Email receipt sent (if configured)

### 3. Admin Panel
- [ ] Can access `/admin-login.html`
- [ ] Can login with new admin credentials
- [ ] Can access `/admin-dashboard.html`
- [ ] Can view orders
- [ ] Can update order status
- [ ] Can manage products
- [ ] Can manage available dates
- [ ] Can view payment proofs

### 4. Security
- [ ] HTTPS is working (required for production)
- [ ] Admin panel is protected (can't access without login)
- [ ] Default admin credentials don't work
- [ ] CORS is configured correctly

### 5. File Uploads
- [ ] Payment proof upload works
- [ ] Product image upload works (admin)
- [ ] Uploaded files are accessible
- [ ] File size limits enforced

---

## 🔧 Troubleshooting Common Issues

### Issue: "Cannot find module" errors
**Solution:** 
- Ensure `npm install --production` was run
- Check Node.js version: `node --version` (needs >= 14.0.0)

### Issue: Port already in use
**Solution:**
- Check what's using the port: `lsof -i :3000` or `netstat -tulpn | grep :3000`
- Change PORT in environment variables if GoDaddy assigns a different port
- Kill the process if it's an old instance: `kill -9 <PID>`

### Issue: Environment variables not working
**Solution:**
- Verify variables are set: `echo $NODE_ENV`
- Use `.env` file with `dotenv` package (already included)
- Check cPanel environment variables section

### Issue: SSL/HTTPS not working
**Solution:**
- Enable SSL certificate in GoDaddy hosting panel
- Update BASE_URL to use `https://` not `http://`
- Clear browser cache

### Issue: Database errors
**Solution:**
- Ensure SQLite has write permissions: `chmod 664 orders.db`
- Check directory permissions: `chmod 755 .`
- Verify `uploads/` directory exists and is writable

### Issue: File uploads not working
**Solution:**
- Check `uploads/` directory permissions: `chmod 755 uploads/`
- Check `uploads/payment-proofs/` exists: `mkdir -p uploads/payment-proofs`
- Verify disk space: `df -h`

---

## 🌐 Alternative Hosting Options (If GoDaddy Doesn't Support Node.js)

If GoDaddy shared hosting doesn't support Node.js, consider these alternatives:

### 1. **Railway.app** (Recommended - Easy & Free Tier)
- ✅ Free tier available
- ✅ Automatic deployments from Git
- ✅ Easy environment variable setup
- ✅ Built-in SSL
- 📖 Guide: https://railway.app

### 2. **Render.com** (Free Tier Available)
- ✅ Free tier for Node.js apps
- ✅ Automatic SSL
- ✅ Easy Git deployments
- 📖 Guide: https://render.com

### 3. **DigitalOcean App Platform**
- ✅ $5/month starter plan
- ✅ Great performance
- ✅ Easy setup
- 📖 Guide: https://www.digitalocean.com/products/app-platform

### 4. **Heroku**
- ✅ Free tier (with limitations)
- ✅ Very easy deployment
- ⚠️ Free tier sleeps after 30min inactivity
- 📖 Guide: https://devcenter.heroku.com

### 5. **GoDaddy VPS** (If staying with GoDaddy)
- ✅ Full control
- ✅ Supports Node.js
- ✅ More expensive than shared hosting

---

## 📞 GoDaddy Support Resources

- **GoDaddy Help Center:** https://www.godaddy.com/help
- **Node.js Hosting Documentation:** Check GoDaddy's knowledge base
- **SSH Access Setup:** Contact GoDaddy support if SSH isn't enabled
- **Environment Variables:** Check cPanel documentation

---

## ✅ Final Deployment Checklist

Before going live:

- [ ] All environment variables set
- [ ] SSL certificate enabled and working
- [ ] Admin credentials changed from defaults
- [ ] JWT_SECRET is a strong random string
- [ ] BASE_URL is set to your production domain (https://)
- [ ] ALLOWED_ORIGINS includes your production domain
- [ ] NODE_ENV=production is set
- [ ] Application starts successfully
- [ ] Test order placed and confirmed
- [ ] Admin login works
- [ ] Email receipts working (if configured)
- [ ] All features tested on production
- [ ] Database backups are working (automatic daily at 2 AM)
- [ ] Monitoring/logging is active

---

## 🎉 Success!

Once all items are checked, your website is ready for production! 

**Important Notes:**
- Monitor your logs regularly: `logs/error-YYYY-MM-DD.log`
- Set up regular database backups (already automated daily at 2 AM)
- Keep Node.js and npm packages updated
- Monitor disk space for uploads and backups

**Good luck with your deployment! 🍰✨**

