# Admin System Testing Guide

## 🍰 Sweets by Toni - Admin Login & Order Management Testing

### Prerequisites
- Server running on http://localhost:3000
- Admin credentials: `admin` / `sweetsbytoni2024`

---

## 📋 Manual Testing Checklist

### 1. Server Startup Test
- [ ] Open browser and navigate to http://localhost:3000
- [ ] Verify main bakery website loads correctly
- [ ] Check browser console for any JavaScript errors

### 2. Admin Login Test
- [ ] Navigate to http://localhost:3000/admin-login.html
- [ ] Verify login page loads with proper styling
- [ ] Test login with **correct credentials**:
  - Username: `admin`
  - Password: `sweetsbytoni2024`
- [ ] Verify successful login redirects to admin dashboard
- [ ] Test login with **incorrect credentials**:
  - Username: `wrong`
  - Password: `wrong`
- [ ] Verify error message displays for invalid credentials

### 3. Admin Dashboard Test
- [ ] Verify admin dashboard loads after successful login
- [ ] Check that statistics cards display:
  - Total Orders
  - Pending Orders  
  - Total Revenue
  - Average Order Value
- [ ] Verify orders table displays existing orders
- [ ] Check that order data shows:
  - Order ID
  - Customer Name
  - Date
  - Status
  - Total Amount

### 4. Order Filtering Test
- [ ] Test "All" filter button (should show all orders)
- [ ] Test "Pending" filter button (should show only pending orders)
- [ ] Test "Confirmed" filter button (should show only confirmed orders)
- [ ] Test "Completed" filter button (should show only completed orders)
- [ ] Test "Cancelled" filter button (should show only cancelled orders)
- [ ] Verify active filter button is highlighted

### 5. Order Details Test
- [ ] Click "View Details" button on any order
- [ ] Verify modal opens with order information
- [ ] Check modal displays:
  - Customer Information (name, email, phone, address, notes)
  - Order Details (ID, delivery date, status, created date)
  - Items Ordered (with images, quantities, prices)
  - Payment Information (subtotal, delivery fee, total)
  - Payment Proof (uploaded image)
- [ ] Test closing modal by clicking X button
- [ ] Test closing modal by clicking outside modal area

### 6. Authentication Protection Test
- [ ] Try accessing http://localhost:3000/admin-dashboard.html directly
- [ ] Verify redirect to login page (if not authenticated)
- [ ] Test logout button functionality
- [ ] Verify token is cleared and redirect to login page
- [ ] Try accessing dashboard again after logout (should require login)

### 7. Refresh & Navigation Test
- [ ] Test "Refresh" button to reload orders
- [ ] Verify statistics update correctly after refresh
- [ ] Test "Back to Main Site" link on login page
- [ ] Test browser back/forward buttons work correctly

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot POST /api/admin/login" Error
**Solution:** Check if server is running and restart if necessary
```bash
cd "C:\Users\flore\OneDrive\Desktop\Sweets by toni"
npm start
```

### Issue: Login Page Doesn't Load
**Solution:** 
- Verify server is running on port 3000
- Check browser console for errors
- Try refreshing the page

### Issue: Dashboard Shows "Loading orders..."
**Solution:**
- Check if you're logged in with valid token
- Verify server is running
- Check browser network tab for failed API calls

### Issue: No Orders Displayed
**Solution:**
- This is normal if no orders have been placed
- Create a test order through the main website first
- Check if orders exist in the database

### Issue: Payment Proof Images Don't Load
**Solution:**
- Verify images exist in `uploads/payment-proofs/` folder
- Check file permissions
- Ensure server has access to uploads directory

---

## 🔧 Technical Details

### Admin Credentials
- **Username:** admin
- **Password:** sweetsbytoni2024
- **Token Expiry:** 24 hours

### API Endpoints Tested
- `POST /api/admin/login` - Admin authentication
- `GET /api/admin/orders` - Retrieve all orders (protected)
- `PATCH /api/admin/orders/:id` - Update order status (protected)
- `GET /api/orders/:id` - Public order lookup

### Database
- SQLite database: `orders.db`
- Orders table with all customer and order information
- Payment proof images stored in `uploads/payment-proofs/`

---

## ✅ Expected Test Results

After completing all tests, you should verify:
- [ ] Login works with correct credentials
- [ ] Invalid credentials are rejected
- [ ] Dashboard loads with order statistics
- [ ] Order filtering works for all statuses
- [ ] Order details modal displays complete information
- [ ] Authentication protection works properly
- [ ] Logout clears session and redirects to login
- [ ] All UI elements are responsive and styled correctly

---

## 📞 Support

If you encounter issues not covered in this guide:
1. Check browser developer console for errors
2. Verify server is running without errors
3. Check database file exists and has data
4. Ensure all dependencies are installed (`npm install`)
