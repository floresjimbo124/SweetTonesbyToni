# 🍰 Sweets by Toni - Bakery Website

A beautiful, functional bakery website with a complete checkout system that saves orders to a database and requires photo proof of payment.

## ✨ Features

- **Responsive Design**: Beautiful bakery theme with pink color scheme
- **Product Catalog**: Featured items, cakes, and cookies with filtering
- **Shopping Cart**: Add/remove items with quantity management
- **Checkout System**: Complete order form with customer details
- **Payment Verification**: Photo upload requirement for payment proof
- **Database Storage**: Orders saved with full details and payment verification
- **Order Management**: Admin endpoints for order tracking and status updates

## 🚀 Quick Start

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn package manager

### Installation

1. **Clone or download the project files**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open your browser**
   - Visit: `http://localhost:3000`
   - The website will load with full functionality

### Development Mode
For development with auto-restart:
```bash
npm run dev
```

## 📁 Project Structure

```
sweets-by-toni/
├── index.html          # Main website page
├── about.html          # About page
├── style.css           # All CSS styles
├── server.js           # Backend API server
├── package.json        # Dependencies and scripts
├── bakery-bg.jpeg      # Background image
└── uploads/            # Payment proof photos (created automatically)
    └── payment-proofs/
```

## 🛒 How the Checkout Works

1. **Add Items**: Customers add products to cart
2. **Proceed to Checkout**: Click "Proceed to checkout" button
3. **Fill Form**: Complete customer information and delivery details
4. **Upload Payment Proof**: Required photo of payment receipt/transfer
5. **Submit Order**: Order saved to database with unique ID
6. **Confirmation**: Customer receives order confirmation

## 🔧 API Endpoints

### Public Endpoints
- `POST /api/orders` - Submit new order
- `GET /api/orders/:orderId` - Get order status

### Admin Endpoints (Add authentication in production)
- `GET /api/admin/orders` - Get all orders
- `PATCH /api/admin/orders/:orderId` - Update order status

## 💾 Database Schema

The current implementation uses an in-memory array, but the data structure is designed to easily migrate to a real database:

```javascript
{
  id: "ST-123456",
  customer: {
    name: "John Doe",
    email: "john@example.com",
    phone: "+1234567890",
    address: "123 Main St",
    notes: "Special instructions"
  },
  items: {
    "cake6": { qty: 1, title: "6\" Cake", price: 45.00 },
    "macs": { qty: 2, title: "Macarons", price: 12.00 }
  },
  delivery: {
    date: "2024-01-15",
    fee: 5.00
  },
  payment: {
    proof: "payment-1234567890-123456789.jpg",
    proof_path: "./uploads/payment-proofs/payment-1234567890-123456789.jpg",
    subtotal: 69.00,
    total: 74.00
  },
  status: "pending",
  created_at: "2024-01-10T10:30:00.000Z",
  updated_at: "2024-01-10T10:30:00.000Z"
}
```

## 🔒 Security Considerations

For production deployment, implement:

1. **Authentication**: Protect admin endpoints
2. **File Upload Validation**: Additional file type and size checks
3. **Rate Limiting**: Prevent spam orders
4. **Input Sanitization**: Validate and sanitize all inputs
5. **HTTPS**: Use SSL certificates
6. **Database**: Replace in-memory storage with proper database
7. **Environment Variables**: Store sensitive configuration

## 📧 Email Receipt Feature

The system now includes **automatic email receipts** sent to customers when they place an order! Customers will receive a beautiful, professionally formatted email with:

- ✅ Order confirmation with unique Order ID
- 📋 Complete list of ordered items with prices
- 📅 Pickup date and time
- 💰 Order summary and total
- 📌 Next steps and contact information

### Setting Up Email

#### Option 1: SendGrid API (Recommended - No Email Password Needed!) ⭐

**SendGrid** is the easiest and most professional way to send emails:
- ✅ **Free tier**: 100 emails/day (perfect for small businesses)
- ✅ **No email credentials needed**: Just one API key
- ✅ **Professional delivery**: Won't be marked as spam
- ✅ **5-minute setup**: Quick and simple

**Quick Setup:**
1. Create free account at: https://sendgrid.com/free/
2. Get your API key (Settings → API Keys)
3. Verify your sender email
4. Set environment variables:
   ```powershell
   $env:SENDGRID_API_KEY="your-api-key"
   $env:SENDGRID_FROM_EMAIL="sweettonesbytoni@gmail.com"
   npm start
   ```

**📖 See `SENDGRID_SETUP.md` for detailed step-by-step instructions!**

#### Option 2: Gmail/Outlook (Alternative)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Create an App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the generated 16-character password

3. **Set Environment Variables**:
   
   **Windows (PowerShell):**
   ```powershell
   $env:EMAIL_SERVICE="gmail"
   $env:EMAIL_USER="your-email@gmail.com"
   $env:EMAIL_PASSWORD="your-app-password"
   $env:EMAIL_FROM="Sweets by Toni <your-email@gmail.com>"
   npm start
   ```

   **Mac/Linux (Terminal):**
   ```bash
   export EMAIL_SERVICE="gmail"
   export EMAIL_USER="your-email@gmail.com"
   export EMAIL_PASSWORD="your-app-password"
   export EMAIL_FROM="Sweets by Toni <your-email@gmail.com>"
   npm start
   ```

   **Or create a `.env` file** (recommended for production):
   ```
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   EMAIL_FROM=Sweets by Toni <your-email@gmail.com>
   ```

#### Option 2: Outlook/Hotmail

```bash
EMAIL_SERVICE=outlook
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
EMAIL_FROM=Sweets by Toni <your-email@outlook.com>
```

#### Option 3: Other Email Services

Nodemailer supports many email services:
- Yahoo: `EMAIL_SERVICE=yahoo`
- iCloud: `EMAIL_SERVICE=iCloud`
- SendGrid, Mailgun, AWS SES: Configure custom SMTP settings

### Email Configuration Variables

**SendGrid (Recommended):**
| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `SENDGRID_API_KEY` | **Yes** | Your SendGrid API key | `SG.abc123...` |
| `SENDGRID_FROM_EMAIL` | **Yes** | Verified sender email | `sweettonesbytoni@gmail.com` |
| `SENDGRID_FROM_NAME` | No | Sender name | `Sweets by Toni` |

**Gmail/Outlook (Alternative):**
| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `EMAIL_SERVICE` | No | Email service provider | `gmail`, `outlook` |
| `EMAIL_USER` | **Yes** | Your email address | `sweettonesbytoni@gmail.com` |
| `EMAIL_PASSWORD` | **Yes** | App password | `abcd efgh ijkl mnop` |
| `EMAIL_FROM` | No | From name and email | `Sweets by Toni <sweettonesbytoni@gmail.com>` |

**📧 Admin Notifications:** Admin notifications are handled through the **in-app notification system** in your admin dashboard! You'll see a notification bell with badge counts, sound alerts, and toast notifications when new orders arrive. Email notifications to admins are disabled by default to prevent inbox spam.

## 🔒 Security Configuration

### Environment Mode (NODE_ENV)

The application automatically adjusts security settings based on the environment:

**Environment Variable:**
| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Recommended | Environment mode | `development` or `production` |

**Production Mode (NODE_ENV=production):**
- ✅ Cookies use `secure: true` (HTTPS required)
- ✅ Cookies use `sameSite: strict` (enhanced CSRF protection)
- ✅ Enhanced security logging

**Development Mode (default):**
- 🛠️ Cookies allow HTTP connections
- 🛠️ Relaxed security for local testing

### CORS (Cross-Origin Resource Sharing)

The application is now configured with secure CORS settings that restrict which domains can access your API.

**Environment Variable:**
| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `ALLOWED_ORIGINS` | No (has defaults) | Comma-separated list of allowed domains | `https://yourdomain.com,https://www.yourdomain.com` |

**Default Behavior (Development):**
- If `ALLOWED_ORIGINS` is not set, defaults to: `http://localhost:3000, http://127.0.0.1:3000`
- Safe for local development

**Production Configuration:**
```bash
# In your hosting platform, set:
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

**Security Features:**
- ✅ Only specified domains can make API requests
- ✅ Blocks unauthorized cross-origin requests
- ✅ Logs blocked requests with warnings
- ✅ Allows same-origin requests (no origin header)

### Testing Email

1. **Start the server** with email configured
2. **Check the console** - you should see: `✅ Email server is ready to send messages`
3. **Place a test order**
4. **Check customer's email inbox** for the receipt

### Troubleshooting Email

**❌ "Email not configured" message:**
- Make sure `EMAIL_USER` and `EMAIL_PASSWORD` are set

**❌ "Authentication failed" error:**
- For Gmail: Use an App Password, not your regular password
- For other services: Verify credentials are correct

**❌ Emails not arriving:**
- Check spam/junk folder
- Verify email address is correct
- Check server console for error messages

**❌ "Less secure app" error (Gmail):**
- Use App Passwords instead of enabling "Less secure apps"
- This is more secure and recommended by Google

## 💾 Database Backup System

The application includes an **automated database backup system** to protect your order data from loss.

### Features

- ✅ **Automatic Daily Backups** - Runs every day at 2:00 AM
- ✅ **Startup Backup** - Creates backup on server start if none exist or last backup is old
- ✅ **30-Day Retention** - Automatically deletes backups older than 30 days
- ✅ **Manual Backups** - Create backups anytime via admin panel API
- ✅ **Download Backups** - Download backup files for safekeeping
- ✅ **Automatic Cleanup** - Removes old backups to save disk space

### Configuration

**Environment Variables:**
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BACKUP_ENABLED` | No | `true` | Enable/disable backup system |
| `BACKUP_RETENTION_DAYS` | No | `30` | Number of days to keep backups |

**Backup Location:** `./backups/` directory in your project root

### Admin API Endpoints

**Get list of backups:**
```
GET /api/admin/backups
```

**Create manual backup:**
```
POST /api/admin/backups
```

**Download a backup:**
```
GET /api/admin/backups/download/:filename
```

**Delete a backup:**
```
DELETE /api/admin/backups/:filename
```

### Backup Schedule

- **Daily Automatic Backup:** 2:00 AM every day
- **Startup Backup:** On server start (if no recent backup exists)
- **Manual Backup:** Anytime via admin API

### Console Messages

When backups are running, you'll see:
```
💾 Database backup system enabled (Retention: 30 days)
⏰ Next automatic backup scheduled in 14.5 hours (at 2:00 AM)
✅ Database backup created: orders-backup-2025-10-21T02-00-00.db (0.52 MB)
🗑️  Deleted old backup: orders-backup-2025-09-15T02-00-00.db
```

### Best Practices

1. **Keep backups off-server** - Periodically download backups to external storage
2. **Test restore process** - Verify backups work by testing restoration
3. **Monitor backup logs** - Check console for backup success/failure messages
4. **Adjust retention** - Set `BACKUP_RETENTION_DAYS` based on your needs

### Disabling Backups

If you have your own backup solution:
```bash
BACKUP_ENABLED=false
```

**Note:** Backup files are excluded from git (in `.gitignore`)

## 🎨 Customization

### Colors and Branding
Edit CSS variables in `style.css`:
```css
:root{
  --accent:#ff7fb0;           /* Main pink */
  --accent-deep:#c93a73;      /* Deep pink */
  --card:#ffe8f3;             /* Card background */
  /* ... more variables */
}
```

### Products
Add/modify products in `index.html` by updating the product articles with proper `data-*` attributes.

### Payment Methods
Update the payment methods list in the checkout form to match your accepted payment options.

## 🚀 Deployment

### Local Development
```bash
npm start
```

### Production Deployment
1. Set up a Node.js hosting service (Heroku, DigitalOcean, AWS, etc.)
2. Configure environment variables
3. Set up a proper database (MongoDB, PostgreSQL, etc.)
4. Configure file storage for payment proofs
5. Set up email service
6. Add SSL certificate
7. Deploy with `npm start`

## 📞 Support

For questions or issues:
- Check the console for error messages
- Verify all dependencies are installed
- Ensure Node.js version is 14 or higher
- Check file permissions for uploads directory

## 📝 License

MIT License - Feel free to use this project for your bakery or modify as needed.

---

**Happy Baking! 🧁✨**
