# 📧 SendGrid Setup Guide (Recommended)

SendGrid provides a simple, free way to send email receipts without needing to configure your personal email. **No email passwords required!**

## ✨ Why SendGrid?

- ✅ **Free tier**: 100 emails/day forever (perfect for small businesses)
- ✅ **No email credentials needed**: Just one API key
- ✅ **Professional**: Emails won't be marked as spam
- ✅ **Simple setup**: 5 minutes to configure
- ✅ **Reliable**: Better deliverability than personal email

## 🚀 Quick Setup (5 Minutes)

### Step 1: Create SendGrid Account

1. Go to: https://sendgrid.com/free/
2. Click **"Start Free"**
3. Fill in your details (use your business name)
4. Verify your email address

### Step 2: Get Your API Key

1. Log in to SendGrid
2. Go to **Settings** → **API Keys** (left sidebar)
3. Click **"Create API Key"**
4. Name it: `Sweets by Toni Production`
5. Select **"Full Access"**
6. Click **"Create & View"**
7. **COPY THE API KEY** (you'll only see it once!)
   - It looks like: `SG.xxxxxxxxxxxxxxxx...`

### Step 3: Verify Sender Email

**Important:** SendGrid requires you to verify the email address you'll send from.

1. Go to **Settings** → **Sender Authentication**
2. Click **"Verify a Single Sender"**
3. Fill in the form:
   - **From Name**: `Sweets by Toni`
   - **From Email**: Your email (e.g., `sweettonesbytoni@gmail.com`)
   - **Reply To**: Same as above
   - Company Address: Your business address
4. Click **"Create"**
5. **Check your email** and click the verification link

### Step 4: Configure Your Server

Set these environment variables:

**Windows (PowerShell):**
```powershell
$env:SENDGRID_API_KEY="your-api-key-here"
$env:SENDGRID_FROM_EMAIL="sweettonesbytoni@gmail.com"
$env:SENDGRID_FROM_NAME="Sweets by Toni"
npm start
```

**Mac/Linux:**
```bash
export SENDGRID_API_KEY="your-api-key-here"
export SENDGRID_FROM_EMAIL="sweettonesbytoni@gmail.com"
export SENDGRID_FROM_NAME="Sweets by Toni"
npm start
```

**Or create a `.env` file** (recommended for production):
```
SENDGRID_API_KEY=your-api-key-here
SENDGRID_FROM_EMAIL=sweettonesbytoni@gmail.com
SENDGRID_FROM_NAME=Sweets by Toni
```

Then install `dotenv` and load it:
```bash
npm install dotenv
```

Add to top of `server.js`:
```javascript
require('dotenv').config();
```

### Step 5: Test It!

1. Start your server
2. Look for this message in console:
   ```
   ✅ SendGrid email service configured
   📧 Emails will be sent from: Sweets by Toni <sweettonesbytoni@gmail.com>
   ```
3. Place a test order
4. Customer should receive email within seconds!

## 📋 Configuration Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `SENDGRID_API_KEY` | **YES** | Your SendGrid API key | `SG.abc123...` |
| `SENDGRID_FROM_EMAIL` | **YES** | Verified sender email | `sweettonesbytoni@gmail.com` |
| `SENDGRID_FROM_NAME` | No | Sender name customers see | `Sweets by Toni` |

## ❓ Troubleshooting

### ⚠️ "Email not configured" message

**Problem:** API key or from email not set

**Solution:**
- Make sure `SENDGRID_API_KEY` is set
- Make sure `SENDGRID_FROM_EMAIL` is set
- Restart your server after setting variables

---

### ❌ "Sender email not verified" error

**Problem:** You haven't verified your sender email in SendGrid

**Solution:**
1. Go to SendGrid → Settings → Sender Authentication
2. Verify your email address
3. Check your inbox for verification email
4. Click the link

---

### 📭 Emails not arriving

**Check these:**
1. ✅ API key is correct (no typos)
2. ✅ Sender email is verified in SendGrid
3. ✅ Check spam/junk folder
4. ✅ Console shows "Confirmation email sent via SendGrid"
5. ✅ Check SendGrid dashboard → Activity for delivery status

---

### 🔄 Want to use different email service?

The system also supports Gmail/Outlook/etc using nodemailer (see `EMAIL_SETUP.md`)

But SendGrid is recommended because:
- No daily limits from Gmail (500/day)
- Better deliverability
- No need for app passwords
- Professional appearance

## 💰 SendGrid Pricing

- **Free**: 100 emails/day forever (3,000/month)
- **Essentials**: $19.95/month for 50,000 emails
- **Pro**: $89.95/month for 100,000 emails

For most small bakeries, the free tier is plenty!

## 🎯 Best Practices

1. **Use a professional email**: `orders@sweetsbytoni.com` looks better than `sweetsbytoni123@gmail.com`
2. **Verify your domain**: For even better deliverability (optional, advanced)
3. **Monitor your usage**: Check SendGrid dashboard weekly
4. **Keep API key secret**: Never commit it to git!

## 🆘 Need Help?

- **SendGrid Docs**: https://docs.sendgrid.com
- **SendGrid Support**: https://support.sendgrid.com
- **Check Activity Feed**: SendGrid Dashboard → Activity (shows all sent emails)

---

**Ready to enable email receipts? Follow the steps above and you'll be sending beautiful order confirmations in minutes! 🎉**

