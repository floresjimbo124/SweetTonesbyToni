# 📊 Data Architecture Analysis

## Current Data Storage Overview

### ✅ What's Using SQLite Database (`orders.db`)

| Data Type | Table | Purpose | Backup Status |
|-----------|-------|---------|---------------|
| **Orders** | `orders` | Customer orders, payment info, order items | ✅ Backed up |
| **Products** | `products` | Product catalog (title, description, category, price, stock) | ✅ Backed up |
| **Product Images** | `product_images` | Product image URLs | ✅ Backed up |
| **Product Variants** | `product_variants` | Size/flavor variations, pricing | ✅ Backed up |

**Database Schema:**
```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT,
  delivery_date TEXT NOT NULL,
  delivery_type TEXT NOT NULL,
  cart_items TEXT NOT NULL,
  subtotal REAL NOT NULL,
  delivery_fee REAL NOT NULL,
  total REAL NOT NULL,
  payment_proof TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price REAL,
  stock INTEGER DEFAULT 0
)

CREATE TABLE product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  url TEXT NOT NULL,
  is_primary INTEGER DEFAULT 0
)

CREATE TABLE product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name TEXT,
  price REAL,
  stock INTEGER DEFAULT 0
)
```

### ⚠️ What's Using JSON Files (NOT in Database)

| File | Purpose | Data | Backup Status |
|------|---------|------|---------------|
| `products.json` | Legacy product storage | Product catalog (DEPRECATED - migrates to DB on startup) | ❌ Not backed up |
| `available-dates.json` | Pickup/delivery slots | Available dates, slot counts, booking info | ❌ Not backed up |
| `product-limits.json` | Order quantity limits | Per-product max order quantities | ❌ Not backed up |

---

## 🚨 CRITICAL ISSUES IDENTIFIED

### Issue #1: ⚠️ Available Dates Not in Database
**Severity:** HIGH  
**Impact:** Data loss risk

**Current Situation:**
- Available pickup/delivery dates stored in `available-dates.json`
- This file is NOT backed up by the automated backup system
- If file corrupts or is deleted, all booking slot data is lost
- Concurrent access issues (file locking on Windows)

**Data at Risk:**
```json
{
  "pickup": [
    {
      "id": "date-1761015756416-lsh61sdkd",
      "type": "pickup",
      "date": "2025-10-25",
      "totalSlots": 5,
      "remainingSlots": 3,
      "notes": "",
      "createdAt": "2025-10-21T03:02:36.416Z",
      "updatedAt": "2025-10-21T03:51:14.474Z"
    }
  ],
  "delivery": [ /* similar structure */ ]
}
```

**Potential Issues:**
1. ❌ **No backups** - Not included in database backup system
2. ❌ **Race conditions** - Multiple simultaneous orders could corrupt file
3. ❌ **File locking** - Windows can lock JSON files during writes
4. ❌ **No transaction support** - Partial writes if server crashes
5. ❌ **No integrity constraints** - Can have invalid data
6. ❌ **Difficult to query** - Can't use SQL for analytics

---

### Issue #2: ⚠️ Product Limits Not in Database
**Severity:** MEDIUM  
**Impact:** Configuration loss risk

**Current Situation:**
- Per-product quantity limits stored in `product-limits.json`
- Currently empty (`{}`) but used for order validation
- Not backed up automatically

**Potential Issues:**
1. ❌ **No backups** - Lost if file corrupts
2. ❌ **Manual management** - Admin must manually edit
3. ❌ **No audit trail** - Can't see who changed limits or when

---

### Issue #3: ⚠️ Uploaded Files Not Backed Up
**Severity:** HIGH  
**Impact:** Data loss, legal issues

**Current Situation:**
- Payment proof images in `uploads/payment-proofs/`
- Product images in `uploads/product-images/`
- These are NOT backed up by the database backup system

**Potential Issues:**
1. ❌ **No backups** - If files deleted, no proof of payment
2. ❌ **Disk space growth** - Unlimited growth over time
3. ❌ **Legal issues** - Payment proofs may be required for disputes
4. ❌ **No cleanup strategy** - Old files accumulate forever

---

## 🔧 RECOMMENDED SOLUTIONS

### Solution 1: Migrate Available Dates to Database

**Create new table:**
```sql
CREATE TABLE available_dates (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- 'pickup' or 'delivery'
  date TEXT NOT NULL,
  total_slots INTEGER NOT NULL,
  remaining_slots INTEGER NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(type, date)
)
```

**Benefits:**
- ✅ Automatic backups
- ✅ Transaction support (no race conditions)
- ✅ Better data integrity
- ✅ SQL queries for analytics
- ✅ Easier to maintain

**Migration Strategy:**
1. Create new table
2. Migrate existing JSON data on startup
3. Update all read/write functions
4. Keep JSON as fallback temporarily
5. Remove JSON file after testing

---

### Solution 2: Migrate Product Limits to Database

**Option A: Add column to products table**
```sql
ALTER TABLE products ADD COLUMN max_order_quantity INTEGER DEFAULT NULL;
```

**Option B: Create separate table**
```sql
CREATE TABLE product_limits (
  product_id TEXT PRIMARY KEY,
  max_quantity INTEGER NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,  -- admin username
  FOREIGN KEY (product_id) REFERENCES products(id)
)
```

**Benefits:**
- ✅ Automatic backups
- ✅ Audit trail (who changed what, when)
- ✅ Better data integrity
- ✅ Part of product management

---

### Solution 3: Implement File Upload Backup System

**Options:**

**A. Include uploads in backup (Simple):**
```javascript
// Backup uploads folder along with database
function backupUploadsFolder() {
  const uploadsBackupPath = path.join(BACKUP_DIR, `uploads-backup-${timestamp}`);
  fs.cpSync('uploads', uploadsBackupPath, { recursive: true });
}
```

**B. Cloud storage (Better):**
- Use AWS S3 / Cloudinary / Google Cloud Storage
- Payment proofs automatically backed up
- Product images served from CDN (faster)
- Reduces server disk usage

**C. Periodic cleanup strategy:**
```javascript
// Delete payment proofs for completed orders older than 90 days
// Archive product images for deleted products
```

---

## 📋 MIGRATION PRIORITY

### Critical (Do Immediately)
1. ✅ **Database Backups** - COMPLETED ✓
2. ⚠️ **Migrate `available-dates.json` to database** - HIGH PRIORITY
3. ⚠️ **Backup uploads folder** - HIGH PRIORITY

### Important (Do Soon)
4. **Migrate `product-limits.json` to database** - MEDIUM PRIORITY
5. **Implement upload cleanup strategy** - MEDIUM PRIORITY
6. **Add audit logging for admin actions** - MEDIUM PRIORITY

### Nice to Have (Future)
7. **Move uploads to cloud storage (S3/Cloudinary)** - LOW PRIORITY
8. **Add database indexing for performance** - LOW PRIORITY
9. **Implement read replicas for scaling** - LOW PRIORITY

---

## 🎯 IMPLEMENTATION ROADMAP

### Phase 1: Fix Critical Issues (1-2 hours)
- [ ] Create `available_dates` table
- [ ] Migrate JSON data to database
- [ ] Update all read/write functions
- [ ] Test booking system thoroughly
- [ ] Backup `uploads` folder in backup system

### Phase 2: Improve Resilience (2-3 hours)
- [ ] Migrate product limits to database
- [ ] Add admin audit logging
- [ ] Implement upload file cleanup
- [ ] Add database indexes for performance

### Phase 3: Scale & Optimize (Future)
- [ ] Cloud storage for uploads
- [ ] Database connection pooling
- [ ] Redis caching for frequently accessed data
- [ ] Database read replicas

---

## ⚡ IMMEDIATE ACTION ITEMS

### What to Do Right Now:

1. **Manual Backup of JSON Files:**
   ```bash
   # Create manual backup of critical JSON files
   mkdir backups/json-backups
   copy available-dates.json backups/json-backups/available-dates-backup.json
   copy product-limits.json backups/json-backups/product-limits-backup.json
   ```

2. **Manual Backup of Uploads:**
   ```bash
   # Backup uploads folder
   mkdir backups/uploads-backup
   xcopy uploads backups/uploads-backup /E /I /H /Y
   ```

3. **Schedule Migration:**
   - Migrate `available-dates.json` to database (HIGH PRIORITY)
   - Test thoroughly before going live
   - Keep JSON as backup for 1 week

---

## 📊 RISK ASSESSMENT

| Risk | Probability | Impact | Priority | Status |
|------|-------------|--------|----------|--------|
| Database corruption | Low | Critical | ✅ | Mitigated (backups implemented) |
| JSON file corruption | Medium | High | ⚠️ | Not mitigated |
| File upload loss | Medium | High | ⚠️ | Not mitigated |
| Concurrent write conflicts | Medium | Medium | ⚠️ | Not mitigated |
| Disk space exhaustion | Low | Medium | ⚠️ | Not mitigated |

---

## 💡 CONCLUSION

**Current Status:**
- ✅ Orders are safely backed up in database
- ✅ Products are safely backed up in database
- ⚠️ Available dates are at risk (JSON file)
- ⚠️ Product limits are at risk (JSON file)
- ⚠️ Uploaded files are at risk (no backup)

**Next Steps:**
1. Create manual backups of JSON files and uploads NOW
2. Migrate available-dates to database (highest priority)
3. Implement upload backup strategy
4. Migrate product-limits to database
5. Add monitoring and alerts

**Your website is 70% protected. The remaining 30% needs attention before production deployment.**

