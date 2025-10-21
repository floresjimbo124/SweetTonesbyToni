# 📧 Email Receipt Setup Guide

This guide will help you configure automatic email receipts for customer orders.

## ✨ What Customers Will Receive

When a customer places an order, they will automatically receive a beautiful email receipt with:

- ✅ Order confirmation with unique Order ID
- 📋 Complete list of items ordered with quantities and prices
- 📅 Pickup/delivery date
- 💰 Order total and payment summary
- 📌 Next steps and what to expect
- 💬 Contact information for questions

## 🚀 Quick Setup (Gmail - Recommended for Testing)

### Step 1: Get a Gmail App Password

1. Make sure you have **2-Factor Authentication** enabled on your Gmail account
   - Go to: https://myaccount.google.com/security
   - Enable 2-Step Verification if not already enabled

2. Create an **App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" as the app
   - Select "Windows Computer" or your device
   - Click "Generate"
   - **Copy the 16-character password** (you'll need it in Step 2)

### Step 2: Configure Environment Variables

#### Option A: Set environment variables when starting the server

**Windows (PowerShell):**
```powershell
$env:EMAIL_SERVICE="gmail"
$env:EMAIL_USER="youremail@gmail.com"
$env:EMAIL_PASSWORD="your-16-char-app-password"
$env:EMAIL_FROM="Sweets Tones by Toni <youremail@gmail.com>"
npm start
```

**Mac/Linux (Terminal):**
```bash
export EMAIL_SERVICE="gmail"
export EMAIL_USER="youremail@gmail.com"
export EMAIL_PASSWORD="your-16-char-app-password"
export EMAIL_FROM="Sweets Tones by Toni <youremail@gmail.com>"
npm start
```

#### Option B: Create a configuration file

Create a file named `.env` in the project root with:

```
EMAIL_SERVICE=gmail
EMAIL_USER=youremail@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
EMAIL_FROM=Sweets Tones by Toni <youremail@gmail.com>
```

**Note:** You'll need to install `dotenv` package and load it in server.js:
```bash
npm install dotenv
```

Then add this to the top of `server.js`:
```javascript
require('dotenv').config();
```

### Step 3: Test It!

1. Start the server with the email configuration
2. Look for this message in the console:
   ```
   ✅ Email server is ready to send messages
   ```
3. Place a test order on your website
4. Check the customer's email inbox (check spam folder too!)

## 🔧 Alternative Email Services

### Outlook/Hotmail

```bash
EMAIL_SERVICE=outlook
EMAIL_USER=youremail@outlook.com
EMAIL_PASSWORD=your-outlook-password
EMAIL_FROM=Sweets Tones by Toni <youremail@outlook.com>
```

### Yahoo

```bash
EMAIL_SERVICE=yahoo
EMAIL_USER=youremail@yahoo.com
EMAIL_PASSWORD=your-yahoo-password
EMAIL_FROM=Sweets Tones by Toni <youremail@yahoo.com>
```

### Custom SMTP Server

If you have a custom email server, modify the nodemailer configuration in `server.js`:

```javascript
emailTransporter = nodemailer.createTransport({
  host: 'smtp.yourserver.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});
```

## 📋 Configuration Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `EMAIL_SERVICE` | No | Email provider | `gmail`, `outlook`, `yahoo` |
| `EMAIL_USER` | **YES** | Your email address | `bakery@gmail.com` |
| `EMAIL_PASSWORD` | **YES** | Email password/app password | `abcd efgh ijkl mnop` |
| `EMAIL_FROM` | No | Sender name & email | `Sweets Tones by Toni <bakery@gmail.com>` |

### 🔔 Admin Order Notifications

**Good news!** Admin notifications are now handled through the **in-app notification system** in your admin dashboard:

- 🔔 **Notification bell** with badge showing new order count
- 🔊 **Sound alerts** when new orders arrive
- 📱 **Toast notifications** with order details
- 🔄 **Auto-refresh** every 30 seconds to check for new orders
- 📋 **Dropdown panel** showing recent orders with customer info and totals
- ✅ **Mark as read** functionality to manage notifications

Email notifications to admins are disabled by default to prevent inbox spam. The in-app system provides real-time updates without cluttering your email!

**To re-enable email notifications (not recommended):**
Edit `server.js` and uncomment the `sendAdminNotification(orderData)` line, then set:
```bash
ADMIN_EMAIL=sweettonesbytoni@gmail.com
```

## ❓ Troubleshooting

### ⚠️ "Email not configured" message in console

**Problem:** Email credentials not set  
**Solution:** Set `EMAIL_USER` and `EMAIL_PASSWORD` environment variables

---

### ❌ "Authentication failed" error

**Problem:** Wrong credentials or app password not used

**For Gmail:**
- ✅ Use an App Password (16 characters, no spaces)
- ❌ Don't use your regular Gmail password

**For other services:**
- Check username and password are correct
- Some services may need specific security settings enabled

---

### 📭 Emails not arriving

**Check these:**
1. ✅ Console shows "Email sent successfully"
2. ✅ Check spam/junk folder
3. ✅ Verify customer email address is correct
4. ✅ Check email service daily sending limits

---

### 🔒 "Less secure app" error

**Problem:** Gmail security blocking the connection

**Solution:**  
✅ Use App Passwords (recommended and secure)  
❌ Don't enable "less secure apps" (deprecated by Google)

---

### 🐛 Server starts but no success message

**Problem:** Invalid email configuration

**Check:**
- Environment variables are set correctly
- No typos in email address
- App password copied correctly (no spaces)

Run this test in PowerShell/Terminal:
```bash
# Windows PowerShell
echo $env:EMAIL_USER
echo $env:EMAIL_PASSWORD

# Mac/Linux
echo $EMAIL_USER
echo $EMAIL_PASSWORD
```

## 🎨 Customizing Email Template

The email template is in `server.js` in the `sendOrderConfirmation` function.

You can customize:
- Colors and styling (inline CSS)
- Logo and header
- Message content
- Footer information
- Contact details

Look for this section in `server.js`:
```javascript
async function sendOrderConfirmation(order) {
  // Email template starts here
  const emailHTML = `...`;
}
```

## 💡 Tips

1. **Test with your own email first** before going live
2. **Check spam folder** on first test - mark as "Not Spam"
3. **Use a dedicated business email** for professional appearance
4. **Keep credentials secure** - never commit them to git
5. **Monitor your email sending limits** - Gmail: 500/day, others vary

## 🚀 Production Recommendations

For high-volume or production use, consider:

- **SendGrid** (Free tier: 100 emails/day)
- **Mailgun** (Free tier: 100 emails/day)
- **AWS SES** (Pay as you go, very affordable)
- **Postmark** (Professional transactional emails)

These services offer:
- ✅ Higher sending limits
- ✅ Better deliverability
- ✅ Detailed analytics
- ✅ No daily limits on free/paid tiers

## 📞 Need Help?

If you're still having issues:
1. Check the server console for detailed error messages
2. Verify all environment variables are set correctly
3. Try with a fresh Gmail App Password
4. Test with a different email address

---

**Happy Baking! 🧁✨**

