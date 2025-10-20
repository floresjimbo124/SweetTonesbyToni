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

## 📧 Email Integration

The system includes placeholder email functionality. To implement real email notifications:

1. Choose an email service (SendGrid, Mailgun, AWS SES)
2. Add email service credentials to environment variables
3. Update the `sendOrderConfirmation()` function in `server.js`
4. Create email templates for customer and admin notifications

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
