# 🚂 Railway.app Deployment Guide

## Quick Fix for SQLite3 Build Error

If you're getting the error: `install apt packages: libatomic1`, the configuration file has been created to fix this.

## Files Created

1. **`apt.txt`** - Tells Railway to install required system packages (libatomic1, python3, make, gcc)
2. **`railway.toml`** - Railway deployment configuration
3. **`Dockerfile`** - Alternative Docker-based deployment (if apt.txt doesn't work)

## Deployment Steps

### 1. Commit the New Files

Make sure `apt.txt` and `railway.toml` are committed to your repository:

```bash
git add apt.txt railway.toml
git commit -m "Add Railway apt.txt for SQLite3 build dependencies"
git push
```

### 2. Deploy on Railway

1. Go to your Railway project dashboard
2. Click "New" → "GitHub Repo" (or connect your repo)
3. Railway will automatically detect the `apt.txt` file and install the packages
4. The build should now succeed!

**Note:** Railway reads `apt.txt` automatically during the build process and installs all packages listed in it.

### 3. Set Environment Variables

In Railway dashboard, go to "Variables" tab and add:

```bash
NODE_ENV=production
BASE_URL=https://your-app-name.up.railway.app
ADMIN_USERNAME=your-secure-admin-username
ADMIN_PASSWORD=your-very-strong-password
JWT_SECRET=your-random-32-character-string-minimum
ALLOWED_ORIGINS=https://your-app-name.up.railway.app
PORT=3000
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Optional: Add Your Domain

1. In Railway, go to "Settings" → "Domains"
2. Add your custom domain
3. Update `BASE_URL` and `ALLOWED_ORIGINS` to your domain
4. Update DNS at GoDaddy to point to Railway

## Troubleshooting

### Build Still Fails?

1. **Check Railway logs** - Look for specific error messages
2. **Verify Node.js version** - Railway should use Node 18+ automatically
3. **Check build logs** - Make sure `libatomic1` is being installed

### SQLite3 Still Won't Build?

**Option 1:** Add more packages to `apt.txt`:
```
libatomic1
python3
make
gcc
g++
libc6-dev
build-essential
```

**Option 2:** Use Dockerfile instead:
1. Delete `apt.txt`
2. Railway will automatically use the `Dockerfile` if present
3. The Dockerfile already includes all necessary build tools

### Database Issues?

- SQLite files are stored in Railway's filesystem
- **Important:** Railway's filesystem is ephemeral - files may be lost on redeploy
- Consider using Railway's PostgreSQL addon for persistent storage (if needed)
- For now, SQLite should work fine for most use cases

## Environment Variables Reference

### Required:
```
NODE_ENV=production
BASE_URL=https://your-domain.com
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-admin-password
JWT_SECRET=your-jwt-secret
ALLOWED_ORIGINS=https://your-domain.com
```

### Optional (Email):
```
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=your-email@example.com
SENDGRID_FROM_NAME=Sweets by Toni
```

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Set environment variables
3. ✅ Test your application
4. ✅ Point your domain (optional)
5. ✅ Test order submission
6. ✅ Test admin login

Your app should now deploy successfully! 🎉

