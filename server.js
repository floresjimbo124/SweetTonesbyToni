require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const XLSX = require('xlsx');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin credentials (in production, use environment variables)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sweetsbytoni2024';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Email configuration (for customer receipts only)
const EMAIL_CONFIG = {
  // SendGrid API (recommended - simpler setup)
  sendgridApiKey: process.env.SENDGRID_API_KEY || '',
  sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL || '',
  sendgridFromName: process.env.SENDGRID_FROM_NAME || 'Sweets by Toni',
  
  // Nodemailer (fallback - requires email credentials)
  service: process.env.EMAIL_SERVICE || 'gmail',
  user: process.env.EMAIL_USER || '',
  pass: process.env.EMAIL_PASSWORD || '',
  from: process.env.EMAIL_FROM || 'Sweets by Toni <noreply@sweetsbytoni.com>'
};

// Email service setup
let emailService = null; // 'sendgrid' or 'nodemailer'
let emailTransporter = null;

// Try SendGrid first (preferred method)
if (EMAIL_CONFIG.sendgridApiKey && EMAIL_CONFIG.sendgridFromEmail) {
  try {
    sgMail.setApiKey(EMAIL_CONFIG.sendgridApiKey);
    emailService = 'sendgrid';
    console.log('✅ SendGrid email service configured');
    console.log(`📧 Emails will be sent from: ${EMAIL_CONFIG.sendgridFromName} <${EMAIL_CONFIG.sendgridFromEmail}>`);
  } catch (error) {
    console.error('❌ SendGrid configuration error:', error.message);
  }
}

// Fallback to Nodemailer if SendGrid not configured
if (!emailService && EMAIL_CONFIG.user && EMAIL_CONFIG.pass) {
  emailTransporter = nodemailer.createTransport({
    service: EMAIL_CONFIG.service,
    auth: {
      user: EMAIL_CONFIG.user,
      pass: EMAIL_CONFIG.pass
    }
  });
  
  // Verify email configuration on startup
  emailTransporter.verify((error, success) => {
    if (error) {
      console.error('❌ Nodemailer configuration error:', error.message);
    } else {
      emailService = 'nodemailer';
      console.log('✅ Nodemailer email service configured');
      console.log(`📧 Emails will be sent from: ${EMAIL_CONFIG.from}`);
    }
  });
}

// No email service configured
if (!emailService) {
  console.log('⚠️  Email not configured.');
  console.log('📧 To enable customer email receipts, choose ONE option:');
  console.log('   Option 1 (Recommended): SendGrid API');
  console.log('     - Set: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL');
  console.log('     - Get free API key at: https://sendgrid.com (100 emails/day free)');
  console.log('   Option 2: Email credentials (Gmail/Outlook/etc)');
  console.log('     - Set: EMAIL_USER, EMAIL_PASSWORD');
}

// CORS configuration - restrict to allowed domains
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  Blocked CORS request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

console.log('🔒 CORS configured. Allowed origins:', allowedOrigins.join(', '));

// Cookie security configuration
const isProduction = process.env.NODE_ENV === 'production';
console.log(`🍪 Cookie security: ${isProduction ? 'SECURE (HTTPS required)' : 'Development mode (HTTP allowed)'}`);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use(express.static('.')); // Serve static files

// Rate limiting for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads/payment-proofs';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'payment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer for product image uploads
const productImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads/product-images';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for payment proof'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const productImageUpload = multer({ 
  storage: productImageStorage,
  fileFilter: function (req, file, cb) {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Initialize SQLite database
const db = new sqlite3.Database('./orders.db');

// ============================================
// DATABASE BACKUP SYSTEM
// ============================================

const BACKUP_DIR = path.join(__dirname, 'backups');
const BACKUP_RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
const BACKUP_ENABLED = process.env.BACKUP_ENABLED !== 'false'; // default: enabled

// Ensure backup directory exists
if (BACKUP_ENABLED && !fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log('📁 Backup directory created:', BACKUP_DIR);
}

/**
 * Create a database backup with timestamp
 * @returns {Promise<string>} Path to the backup file
 */
async function createDatabaseBackup() {
  if (!BACKUP_ENABLED) {
    console.log('⚠️  Backup disabled via BACKUP_ENABLED=false');
    return null;
  }

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFileName = `orders-backup-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);
    const sourcePath = path.join(__dirname, 'orders.db');

    // Check if source database exists
    if (!fs.existsSync(sourcePath)) {
      console.warn('⚠️  Source database not found, skipping backup');
      return null;
    }

    // Use SQLite backup API (doesn't close the database)
    await new Promise((resolve, reject) => {
      db.run('VACUUM', (err) => {
        if (err) console.warn('⚠️  VACUUM warning:', err.message);
        
        // Copy the database file (SQLite can handle this while db is open)
        fs.copyFile(sourcePath, backupPath, async (copyErr) => {
          if (copyErr) {
            console.error('❌ Backup failed:', copyErr.message);
            return reject(copyErr);
          }

          const stats = fs.statSync(backupPath);
          const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
          console.log(`✅ Database backup created: ${backupFileName} (${sizeMB} MB)`);
          
          // Also backup uploads folder
          await backupUploadsFolder(timestamp);
          
          resolve(backupPath);
        });
      });
    });

    return backupPath;
  } catch (error) {
    console.error('❌ Backup error:', error.message);
    return null;
  }
}

/**
 * Backup uploads folder (payment proofs and product images)
 */
async function backupUploadsFolder(timestamp) {
  try {
    const uploadsSource = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsSource)) {
      console.log('⚠️  Uploads folder not found, skipping uploads backup');
      return;
    }

    const uploadsBackupPath = path.join(BACKUP_DIR, `uploads-backup-${timestamp}`);
    
    // Use recursive copy
    fs.cpSync(uploadsSource, uploadsBackupPath, { recursive: true });
    
    // Calculate size
    let totalSize = 0;
    function calculateSize(dir) {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          calculateSize(filePath);
        } else {
          totalSize += stats.size;
        }
      });
    }
    calculateSize(uploadsBackupPath);
    
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    console.log(`✅ Uploads backup created: uploads-backup-${timestamp} (${sizeMB} MB)`);
  } catch (error) {
    console.error('❌ Uploads backup failed:', error.message);
    // Don't fail the whole backup if uploads backup fails
  }
}

/**
 * Clean up old backups beyond retention period
 */
function cleanupOldBackups() {
  if (!BACKUP_ENABLED) return;

  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const dbBackups = files.filter(f => f.startsWith('orders-backup-') && f.endsWith('.db'));
    const uploadsBackups = files.filter(f => f.startsWith('uploads-backup-'));
    
    const now = Date.now();
    const retentionMs = BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    
    let deletedCount = 0;
    
    // Clean up old database backups
    dbBackups.forEach(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;
      
      if (age > retentionMs) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`🗑️  Deleted old database backup: ${file}`);
      }
    });
    
    // Clean up old uploads backups
    uploadsBackups.forEach(dir => {
      const dirPath = path.join(BACKUP_DIR, dir);
      try {
        const stats = fs.statSync(dirPath);
        const age = now - stats.mtimeMs;
        
        if (age > retentionMs && stats.isDirectory()) {
          fs.rmSync(dirPath, { recursive: true, force: true });
          deletedCount++;
          console.log(`🗑️  Deleted old uploads backup: ${dir}`);
        }
      } catch (e) {
        console.warn(`⚠️  Could not delete ${dir}:`, e.message);
      }
    });

    if (deletedCount > 0) {
      console.log(`✅ Cleaned up ${deletedCount} old backup(s)`);
    }
  } catch (error) {
    console.error('❌ Error cleaning up backups:', error.message);
  }
}

/**
 * Get list of available backups
 */
function getBackupList() {
  if (!BACKUP_ENABLED || !fs.existsSync(BACKUP_DIR)) {
    return [];
  }

  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const backupFiles = files
      .filter(f => f.startsWith('orders-backup-') && f.endsWith('.db'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: filePath,
          size: stats.size,
          sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
          created: stats.mtime,
          age: Math.floor((Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24)) // days
        };
      })
      .sort((a, b) => b.created - a.created); // newest first

    return backupFiles;
  } catch (error) {
    console.error('❌ Error getting backup list:', error.message);
    return [];
  }
}

// Schedule daily backups (at 2 AM)
if (BACKUP_ENABLED) {
  const scheduleNextBackup = () => {
    const now = new Date();
    const next = new Date();
    next.setHours(2, 0, 0, 0); // 2:00 AM
    
    if (next <= now) {
      next.setDate(next.getDate() + 1); // Tomorrow at 2 AM
    }
    
    const timeUntilBackup = next - now;
    
    setTimeout(async () => {
      console.log('🕐 Running scheduled daily backup...');
      await createDatabaseBackup();
      cleanupOldBackups();
      scheduleNextBackup(); // Schedule next backup
    }, timeUntilBackup);
    
    const hoursUntil = (timeUntilBackup / (1000 * 60 * 60)).toFixed(1);
    console.log(`⏰ Next automatic backup scheduled in ${hoursUntil} hours (at 2:00 AM)`);
  };
  
  scheduleNextBackup();
  
  // Create initial backup on startup (if none exist or last backup is old)
  const backups = getBackupList();
  if (backups.length === 0 || backups[0].age >= 1) {
    setTimeout(() => {
      console.log('🔄 Creating initial backup on startup...');
      createDatabaseBackup().then(() => {
        console.log('✅ Initial backup complete');
      }).catch(err => {
        console.error('❌ Initial backup failed:', err.message);
      });
    }, 5000); // Wait 5 seconds after startup
  }
  
  console.log(`💾 Database backup system enabled (Retention: ${BACKUP_RETENTION_DAYS} days)`);
} else {
  console.log('⚠️  Database backup system disabled');
}

// Product limits functions (migrated to database)
const PRODUCT_LIMITS_PATH = path.join(__dirname, 'product-limits.json');

async function readProductLimits(){
  try{
    const rows = await dbAll('SELECT product_id, max_quantity FROM product_limits');
    const limits = {};
    rows.forEach(row => {
      limits[row.product_id] = row.max_quantity;
    });
    return limits;
  } catch(e){
    console.error('Failed to read product limits from database:', e);
    return {};
  }
}

async function writeProductLimits(limits){
  try{
    // Deprecated - use setProductLimit instead
    console.warn('writeProductLimits is deprecated - use setProductLimit instead');
    return true;
  } catch(e){
    console.error('Failed to write product limits:', e);
    return false;
  }
}

async function setProductLimit(productId, maxQuantity, updatedBy = 'admin') {
  try {
    await dbRun(
      `INSERT INTO product_limits (product_id, max_quantity, updated_by, updated_at) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(product_id) DO UPDATE SET 
         max_quantity = excluded.max_quantity,
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [productId, maxQuantity, updatedBy]
    );
  } catch (e) {
    console.error('Failed to set product limit:', e);
    throw e;
  }
}

async function getProductLimit(productId) {
  try {
    const row = await dbGet('SELECT max_quantity FROM product_limits WHERE product_id = ?', [productId]);
    return row ? row.max_quantity : null;
  } catch (e) {
    console.error('Failed to get product limit:', e);
    return null;
  }
}

async function deleteProductLimit(productId) {
  try {
    await dbRun('DELETE FROM product_limits WHERE product_id = ?', [productId]);
  } catch (e) {
    console.error('Failed to delete product limit:', e);
    throw e;
  }
}

// Available dates helper functions (migrated to database)
async function readAvailableDates() {
  try {
    const rows = await dbAll('SELECT * FROM available_dates ORDER BY date ASC');
    const result = { pickup: [], delivery: [] };
    
    rows.forEach(row => {
      const dateObj = {
        id: row.id,
        type: row.type,
        date: row.date,
        totalSlots: row.total_slots,
        remainingSlots: row.remaining_slots,
        notes: row.notes || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
      
      if (row.type === 'pickup') {
        result.pickup.push(dateObj);
      } else if (row.type === 'delivery') {
        result.delivery.push(dateObj);
      }
    });
    
    return result;
  } catch (e) {
    console.error('Failed to read available dates from database:', e);
    return { pickup: [], delivery: [] };
  }
}

async function writeAvailableDates(dates) {
  try {
    // This function is now deprecated - use individual CRUD operations instead
    // Kept for backward compatibility during migration
    console.warn('writeAvailableDates is deprecated - use database operations directly');
    return true;
  } catch (e) {
    console.error('Failed to write available dates:', e);
    return false;
  }
}

// New database-first functions for available dates
async function createAvailableDate(dateData) {
  const { id, type, date, totalSlots, notes = '' } = dateData;
  await dbRun(
    `INSERT INTO available_dates (id, type, date, total_slots, remaining_slots, notes) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, type, date, totalSlots, totalSlots, notes]
  );
}

async function updateAvailableDate(id, updates) {
  const { totalSlots, remainingSlots, notes } = updates;
  const sets = [];
  const params = [];
  
  if (totalSlots !== undefined) {
    sets.push('total_slots = ?');
    params.push(totalSlots);
  }
  if (remainingSlots !== undefined) {
    sets.push('remaining_slots = ?');
    params.push(remainingSlots);
  }
  if (notes !== undefined) {
    sets.push('notes = ?');
    params.push(notes);
  }
  
  sets.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);
  
  await dbRun(
    `UPDATE available_dates SET ${sets.join(', ')} WHERE id = ?`,
    params
  );
}

async function deleteAvailableDate(id) {
  await dbRun('DELETE FROM available_dates WHERE id = ?', [id]);
}

async function decrementAvailableDateSlot(type, date) {
  await dbRun(
    `UPDATE available_dates 
     SET remaining_slots = remaining_slots - 1, updated_at = CURRENT_TIMESTAMP 
     WHERE type = ? AND date = ? AND remaining_slots > 0`,
    [type, date]
  );
}

// Create orders table if it doesn't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    customer_instagram TEXT,
    customer_notes TEXT,
    delivery_date TEXT NOT NULL,
    delivery_fee REAL NOT NULL,
    subtotal REAL NOT NULL,
    total REAL NOT NULL,
    payment_proof TEXT NOT NULL,
    payment_proof_path TEXT NOT NULL,
    cart_items TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Add delivery_type column if it doesn't exist (for existing databases)
  db.run(`ALTER TABLE orders ADD COLUMN delivery_type TEXT DEFAULT 'pickup'`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.warn('⚠️  Could not add delivery_type column:', err.message);
    } else if (!err) {
      console.log('✅ Added delivery_type column to orders table');
    }
  });
  // Products tables
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    img TEXT,
    category TEXT,
    price REAL,
    stock INTEGER,
    hasVariants INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    url TEXT NOT NULL,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    name TEXT,
    size TEXT,
    price REAL,
    stock INTEGER,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  )`);
  
  // New table for available dates (migrated from JSON)
  db.run(`CREATE TABLE IF NOT EXISTS available_dates (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('pickup', 'delivery')),
    date TEXT NOT NULL,
    total_slots INTEGER NOT NULL DEFAULT 0,
    remaining_slots INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(type, date)
  )`);
  
  // New table for product limits (migrated from JSON)
  db.run(`CREATE TABLE IF NOT EXISTS product_limits (
    product_id TEXT PRIMARY KEY,
    max_quantity INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  )`);
  
  console.log('✅ All database tables initialized');
});

// JSON path for initial migration
const PRODUCTS_PATH = path.join(__dirname, 'products.json');

// DB helpers
function dbAll(sql, params = []){
  return new Promise((resolve, reject)=>{
    db.all(sql, params, (err, rows)=>{
      if(err) return reject(err);
      resolve(rows);
    });
  });
}
function dbGet(sql, params = []){
  return new Promise((resolve, reject)=>{
    db.get(sql, params, (err, row)=>{
      if(err) return reject(err);
      resolve(row);
    });
  });
}
function dbRun(sql, params = []){
  return new Promise((resolve, reject)=>{
    db.run(sql, params, function(err){
      if(err) return reject(err);
      resolve(this);
    });
  });
}

async function getAllProductsFromDb(){
  const base = await dbAll(`SELECT * FROM products`);
  const images = await dbAll(`SELECT product_id, url FROM product_images`);
  const variants = await dbAll(`SELECT * FROM product_variants`);
  const idToImages = {};
  images.forEach(i=>{ (idToImages[i.product_id] ||= []).push(i.url); });
  const idToVariants = {};
  variants.forEach(v=>{ (idToVariants[v.product_id] ||= []).push({ id: v.id, name: v.name, size: v.size, price: v.price, stock: v.stock }); });
  return base.map(p=>({
    id: p.id,
    title: p.title,
    description: p.description || '',
    img: p.img || '',
    category: p.category || 'cookies',
    price: p.price,
    stock: p.stock,
    hasVariants: !!p.hasVariants,
    additionalImages: idToImages[p.id] || [],
    variants: idToVariants[p.id] || []
  }));
}

async function upsertProductToDb(p){
  const hasVariants = p.hasVariants ? 1 : 0;
  await dbRun(`INSERT INTO products (id, title, description, img, category, price, stock, hasVariants) VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description, img=excluded.img, category=excluded.category, price=excluded.price, stock=excluded.stock, hasVariants=excluded.hasVariants`,
    [p.id, p.title, p.description || '', p.img || '', p.category || 'cookies',
      p.price === null || p.price === undefined ? null : Number(p.price),
      p.stock === null || p.stock === undefined ? null : Number(p.stock),
      hasVariants]
  );
  // Only modify images if explicitly provided
  if (p.additionalImages !== undefined) {
    await dbRun(`DELETE FROM product_images WHERE product_id = ?`, [p.id]);
    const imgs = Array.isArray(p.additionalImages) ? p.additionalImages : [];
    for(const url of imgs){
      await dbRun(`INSERT INTO product_images (product_id, url) VALUES (?,?)`, [p.id, url]);
    }
  }
  // Only modify variants if explicitly provided
  if (p.variants !== undefined) {
    await dbRun(`DELETE FROM product_variants WHERE product_id = ?`, [p.id]);
    const vars = Array.isArray(p.variants) ? p.variants : [];
    for(const v of vars){
      const vid = v.id || `${p.id}-${String(v.name||'').toLowerCase().replace(/\s+/g,'-')}`;
      await dbRun(`INSERT INTO product_variants (id, product_id, name, size, price, stock) VALUES (?,?,?,?,?,?)`, [vid, p.id, String(v.name||''), String(v.size||v.name||''), Number(v.price)||0, Math.max(0, Number(v.stock)||0)]);
    }
  }
}

async function deleteProductFromDb(id){
  await dbRun(`DELETE FROM product_images WHERE product_id=?`, [id]);
  await dbRun(`DELETE FROM product_variants WHERE product_id=?`, [id]);
  await dbRun(`DELETE FROM products WHERE id=?`, [id]);
}

async function getProductByIdFromDb(id){
  const product = await dbGet(`SELECT * FROM products WHERE id = ?`, [id]);
  if (!product) return null;
  
  const images = await dbAll(`SELECT product_id, url FROM product_images WHERE product_id = ?`, [id]);
  const variants = await dbAll(`SELECT * FROM product_variants WHERE product_id = ?`, [id]);
  
  return {
    id: product.id,
    title: product.title,
    description: product.description || '',
    img: product.img || '',
    category: product.category || 'cookies',
    price: product.price,
    stock: product.stock,
    hasVariants: !!product.hasVariants,
    additionalImages: images.map(i => i.url),
    variants: variants.map(v => ({ id: v.id, name: v.name, size: v.size, price: v.price, stock: v.stock }))
  };
}

// Public: get products
app.get('/api/products', async (req, res) => {
  try{
    const items = await getAllProductsFromDb();
    res.set('Cache-Control', 'no-store');
    res.json({ products: items });
  } catch(e){
    console.error('Failed to load products from DB:', e);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// Admin: CRUD products
app.post('/api/admin/products', authenticateAdmin, async (req, res) => {
  try{
    const p = req.body || {};
    console.log('Creating product with data:', JSON.stringify(p, null, 2));
    if(!p.id || !p.title){
      return res.status(400).json({ error: 'Missing id or title' });
    }
    const existing = await dbGet(`SELECT id FROM products WHERE id = ?`, [p.id]);
    if(existing){
      return res.status(409).json({ error: 'Product id already exists' });
    }
    const title = String(p.title).trim();
    const descriptionInput = typeof p.description === 'string' ? p.description : '';
    const description = String(descriptionInput).trim();
    if(!title){
      return res.status(400).json({ error: 'Title is required' });
    }
    const payload = {
      id: String(p.id),
      title,
      description,
      img: typeof p.img === 'string' ? p.img : '',
      category: typeof p.category === 'string' ? p.category : 'cookies',
      price: p.hasVariants ? null : (Number(p.price) || 0),
      stock: p.hasVariants ? null : Math.max(0, Number(p.stock) || 0),
      hasVariants: Boolean(p.hasVariants),
      additionalImages: Array.isArray(p.additionalImages) ? p.additionalImages : [],
      variants: Array.isArray(p.variants) ? p.variants : []
    };
    await upsertProductToDb(payload);
    const created = (await getAllProductsFromDb()).find(x=>x.id===payload.id);
    res.json({ success: true, product: created });
  } catch(e){
    console.error('Failed to create product:', e);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.put('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
  try{
    const id = req.params.id;
    const curr = await dbGet(`SELECT * FROM products WHERE id=?`, [id]);
    if(!curr) return res.status(404).json({ error: 'Not found' });
    const updates = req.body || {};
    console.log(`Updating product ${id} with:`, JSON.stringify(updates, null, 2));
    const targetHasVariants = ('hasVariants' in updates) ? Boolean(updates.hasVariants) : !!curr.hasVariants;
    const nextTitle = 'title' in updates ? String(updates.title || curr.title).trim() : String(curr.title || '').trim();
    const descInput = 'description' in updates ? String(updates.description || '') : String(curr.description || '');
    const nextDescription = String(descInput).trim();
    if(!nextTitle){
      return res.status(400).json({ error: 'Title is required' });
    }
    const payload = {
      id,
      title: nextTitle,
      description: nextDescription,
      img: 'img' in updates ? String(updates.img || '') : (curr.img || ''),
      category: 'category' in updates ? String(updates.category || 'cookies') : (curr.category || 'cookies'),
      price: targetHasVariants ? null : ('price' in updates ? (Number(updates.price) || 0) : curr.price),
      stock: targetHasVariants ? null : ('stock' in updates ? Math.max(0, Number(updates.stock) || 0) : curr.stock),
      hasVariants: targetHasVariants,
      additionalImages: 'additionalImages' in updates ? (Array.isArray(updates.additionalImages) ? updates.additionalImages : []) : undefined,
      variants: 'variants' in updates ? (Array.isArray(updates.variants) ? updates.variants : []) : undefined
    };
    await upsertProductToDb(payload);
    const next = (await getAllProductsFromDb()).find(x=>x.id===id);
    res.json({ success: true, product: next });
  } catch(e){
    console.error('Failed to update product:', e);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Upload product images
app.post('/api/admin/products/images', authenticateAdmin, productImageUpload.array('images', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }
    
    const imageUrls = req.files.map(file => `/uploads/product-images/${file.filename}`);
    res.json({ success: true, imageUrls });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

app.delete('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
  try{
    const id = req.params.id;
    const curr = await dbGet(`SELECT id FROM products WHERE id=?`, [id]);
    if(!curr) return res.status(404).json({ error: 'Not found' });
    await deleteProductFromDb(id);
    res.json({ success: true });
  } catch(e){
    console.error('Failed to delete product:', e);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Authentication middleware
function authenticateAdmin(req, res, next) {
  const bearer = req.headers.authorization?.replace('Bearer ', '');
  const cookieToken = req.cookies?.admin_token;
  const token = bearer || cookieToken;

  if (!token) {
    console.warn('Auth failed: no token present');
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    console.warn('Auth failed: invalid token', error?.message);
    res.status(401).json({ error: 'Invalid token.' });
  }
}

// Function to generate order ID with incrementing number
function generateOrderId(firstName) {
  return new Promise((resolve, reject) => {
    const prefix = firstName.substring(0, 3).toUpperCase();
    
    // Check existing orders with same prefix
    db.get(
      `SELECT COUNT(*) as count FROM orders WHERE id LIKE ?`,
      [`${prefix}%`],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        const nextNumber = (row.count || 0) + 1;
        const orderId = `${prefix}${nextNumber.toString().padStart(3, '0')}`;
        resolve(orderId);
      }
    );
  });
}

// Timing-safe string compare
function timingSafeEqual(a, b) {
  const encA = Buffer.from(String(a), 'utf8');
  const encB = Buffer.from(String(b), 'utf8');
  if (encA.length !== encB.length) {
    const dummy = Buffer.alloc(encA.length);
    try {
      crypto.timingSafeEqual(encA, dummy);
    } catch (_) {}
    return false;
  }
  return crypto.timingSafeEqual(encA, encB);
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Public endpoint to fetch product limits (for client-side enforcement)
app.get('/api/product-limits', async (req, res) => {
  const limits = await readProductLimits();
  res.json({ limits });
});

// Admin login route
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  const normalizedPassword = typeof password === 'string' ? password : '';

  const isUserOk = timingSafeEqual(normalizedUsername, ADMIN_USERNAME);
  const isPassOk = timingSafeEqual(normalizedPassword, ADMIN_PASSWORD);

  if (isUserOk && isPassOk) {
    const token = jwt.sign(
      { username: ADMIN_USERNAME, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('admin_token', token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      secure: process.env.NODE_ENV === 'production', // true in production (HTTPS required)
      path: '/',
      maxAge: 24 * 60 * 60 * 1000
    });
    console.log('Admin login successful, cookie set.');
    return res.json({ success: true, message: 'Login successful', token });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

// Admin endpoints to manage per-product quantity limits
app.get('/api/admin/product-limits', authenticateAdmin, async (req, res) => {
  const limits = await readProductLimits();
  res.json({ limits });
});

app.put('/api/admin/product-limits', authenticateAdmin, async (req, res) => {
  try{
    const body = req.body || {};
    const incoming = body.limits;
    if(!incoming || typeof incoming !== 'object'){
      return res.status(400).json({ error: 'Invalid payload: expected { limits: { [productId]: number } }' });
    }
    
    // Update each product limit in database
    for(const [productId, val] of Object.entries(incoming)){
      const n = Number(val);
      if(Number.isFinite(n) && n >= 0){
        if(n === 0){
          // Remove limit if set to 0
          await deleteProductLimit(productId);
        } else {
          await setProductLimit(productId, n, req.admin?.username || 'admin');
        }
      }
    }
    
    // Return updated limits
    const updated = await readProductLimits();
    res.json({ success: true, limits: updated });
  } catch(e){
    console.error('Error updating product limits', e);
    res.status(500).json({ error: 'Server error updating limits' });
  }
});

// Admin logout route - clears auth cookie
app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/'
  });
  return res.json({ success: true });
});

// Simple auth check endpoint
app.get('/api/admin/me', authenticateAdmin, (req, res) => {
  res.json({ authenticated: true, user: { username: req.admin.username, role: req.admin.role } });
});

// ============================================
// DATABASE BACKUP API ENDPOINTS
// ============================================

// Get list of available backups
app.get('/api/admin/backups', authenticateAdmin, (req, res) => {
  try {
    const backups = getBackupList();
    res.json({
      success: true,
      backups,
      enabled: BACKUP_ENABLED,
      retentionDays: BACKUP_RETENTION_DAYS,
      backupDir: BACKUP_DIR
    });
  } catch (error) {
    console.error('Error getting backup list:', error);
    res.status(500).json({ error: 'Failed to get backup list', details: error.message });
  }
});

// Create manual backup
app.post('/api/admin/backups', authenticateAdmin, async (req, res) => {
  try {
    if (!BACKUP_ENABLED) {
      return res.status(400).json({ error: 'Backup system is disabled' });
    }

    console.log('📦 Admin requested manual backup...');
    const backupPath = await createDatabaseBackup();
    
    if (!backupPath) {
      return res.status(500).json({ error: 'Backup failed' });
    }

    const backups = getBackupList();
    res.json({
      success: true,
      message: 'Backup created successfully',
      backup: backups[0], // Return the newest backup (just created)
      totalBackups: backups.length
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup', details: error.message });
  }
});

// Download a specific backup
app.get('/api/admin/backups/download/:filename', authenticateAdmin, (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security: ensure filename is safe (no path traversal)
    if (!filename.startsWith('orders-backup-') || !filename.endsWith('.db')) {
      return res.status(400).json({ error: 'Invalid backup filename' });
    }

    const backupPath = path.join(BACKUP_DIR, filename);
    
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    res.download(backupPath, filename, (err) => {
      if (err) {
        console.error('Error downloading backup:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download backup' });
        }
      }
    });
  } catch (error) {
    console.error('Error downloading backup:', error);
    res.status(500).json({ error: 'Failed to download backup', details: error.message });
  }
});

// Delete a specific backup
app.delete('/api/admin/backups/:filename', authenticateAdmin, (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security: ensure filename is safe
    if (!filename.startsWith('orders-backup-') || !filename.endsWith('.db')) {
      return res.status(400).json({ error: 'Invalid backup filename' });
    }

    const backupPath = path.join(BACKUP_DIR, filename);
    
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    fs.unlinkSync(backupPath);
    console.log(`🗑️  Admin deleted backup: ${filename}`);
    
    const backups = getBackupList();
    res.json({
      success: true,
      message: 'Backup deleted successfully',
      totalBackups: backups.length
    });
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({ error: 'Failed to delete backup', details: error.message });
  }
});

// API endpoint to submit orders
app.post('/api/orders', upload.single('payment_proof'), async (req, res) => {
  try {
    // Debug: Log received data
    console.log('Order submission received:');
    console.log('Body fields:', Object.keys(req.body));
    console.log('File:', req.file ? 'Present' : 'Missing');
    console.log('Name:', req.body.name);
    console.log('Email:', req.body.email);
    console.log('Phone:', req.body.phone);
    console.log('Delivery Date:', req.body.delivery_date);
    console.log('Cart:', req.body.cart);
    
    // Validate required fields
    const { name, email, phone, delivery_date, delivery_type, address, instagram, cart, order_id_prefix, subtotal, total } = req.body;
    
    if (!name || !email || !phone || !delivery_date || !cart || !req.file) {
      console.log('Validation failed - missing fields:', {
        name: !!name,
        email: !!email,
        phone: !!phone,
        delivery_date: !!delivery_date,
        cart: !!cart,
        file: !!req.file
      });
      return res.status(400).json({ 
        error: 'Missing required fields or payment proof' 
      });
    }

    // Human verification (puzzle captcha): client shows a target emoji and indices of selected choices
    // Slider captcha check: must be '1'
    const sliderOk = String(req.body.slider_ok || '0');
    if(sliderOk !== '1'){
      return res.status(400).json({ error: 'Failed human verification. Please slide to verify and try again.' });
    }

    // Parse cart data
    let cartItems;
    try {
      cartItems = JSON.parse(cart);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid cart data' });
    }

    // Generate unique order ID based on first name
    const orderId = await generateOrderId(name.trim());

    // Optional: decrement stock for products that exist in catalog (DB-backed)
    const catalog = await getAllProductsFromDb();
    const idToIndex = Object.fromEntries(catalog.map((p, i) => [p.id, i]));
    const itemsArray = Array.isArray(cartItems) ? cartItems : Object.values(cartItems || {});
    // Build a map of requested qty per id
    const requested = {};
    itemsArray.forEach(item => {
      const id = item.id || item.productId || item?.el?.dataset?.id; // tolerate shapes
      const qty = Number(item.qty || item.quantity || 0);
      if(!id || !Number.isFinite(qty)) return;
      requested[id] = (requested[id] || 0) + qty;
    });
    
    // Validate stock for both regular products and variants
    for(const [id, qty] of Object.entries(requested)){
      let product = null;
      let variant = null;
      let stock = null;
      let productTitle = id;
      
      // First, try to find as a variant ID
      for (const productData of catalog) {
        if (productData.hasVariants && productData.variants) {
          const foundVariant = productData.variants.find(v => v.id === id);
          if (foundVariant) {
            product = productData;
            variant = foundVariant;
            stock = variant.stock;
            productTitle = `${productData.title} - ${variant.name}`;
            break;
          }
        }
      }
      
      // If not found as variant, try as regular product
      if (!product) {
        const idx = idToIndex[id];
        if (idx !== undefined) {
          product = catalog[idx];
          stock = product.stock;
          productTitle = product.title;
        }
      }
      
      if (product && Number.isFinite(stock) && qty > stock) {
        return res.status(400).json({ error: `Insufficient stock for ${productTitle}. Available: ${stock}.` });
      }
    }
    
    // Decrement stock for both regular products and variants
    let mutated = false;
    for(const [id, qty] of Object.entries(requested)){
      let product = null;
      let variant = null;
      let stock = null;
      
      // First, try to find as a variant ID
      for (const productData of catalog) {
        if (productData.hasVariants && productData.variants) {
          const foundVariant = productData.variants.find(v => v.id === id);
          if (foundVariant) {
            product = productData;
            variant = foundVariant;
            stock = variant.stock;
            break;
          }
        }
      }
      
      // If not found as variant, try as regular product
      if (!product) {
        const idx = idToIndex[id];
        if (idx !== undefined) {
          product = catalog[idx];
          stock = product.stock;
        }
      }
      
      if (product && Number.isFinite(stock)) {
        if (variant) {
          // Update variant stock in DB
          await dbRun(`UPDATE product_variants SET stock = ? WHERE id = ?`, [Math.max(0, stock - qty), variant.id]);
          mutated = true;
        } else {
          // Update regular product stock in DB
          await dbRun(`UPDATE products SET stock = ? WHERE id = ?`, [Math.max(0, stock - qty), product.id]);
          mutated = true;
        }
      }
    }
    
    // No JSON write needed; DB already updated
    
    // Decrement remaining slots for the selected date (database version)
    try {
      const dateType = delivery_type || 'pickup'; // Default to pickup if not specified
      await decrementAvailableDateSlot(dateType, delivery_date);
      console.log(`📅 Decremented slot for ${dateType} on ${delivery_date}`);
    } catch (error) {
      console.error('Error decrementing slots:', error);
      // Don't fail the order if slot update fails
    }

    // Save order to database
    const stmt = db.prepare(`
      INSERT INTO orders (
        id, customer_name, customer_email, customer_phone, customer_address,
        customer_instagram, customer_notes, delivery_date, delivery_type, delivery_fee, subtotal, total,
        payment_proof, payment_proof_path, cart_items, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      orderId,
      name.trim(),
      email.trim(),
      phone.trim(),
      address ? address.trim() : 'Store Pickup',
      instagram ? instagram.trim() : '',
      req.body.notes || '',
      delivery_date,
      delivery_type || 'pickup', // Default to pickup if not specified
      0.00,
      parseFloat(subtotal),
      parseFloat(total),
      req.file.filename,
      req.file.path,
      JSON.stringify(cartItems),
      'pending'
    ], function(err) {
      if (err) {
        console.error('Database error:', err);
        
        // Clean up uploaded file if database save fails
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting uploaded file:', err);
        });
        
        return res.status(500).json({ 
          error: 'Failed to save order to database',
          message: 'Please try again or contact us directly'
        });
      }

      console.log('New order saved to database:', {
        order_id: orderId,
        customer: name.trim(),
        email: email.trim(),
        total: parseFloat(total),
        items_count: Object.keys(cartItems).length
      });

      // Prepare order data for emails
      const orderData = {
        id: orderId,
        customer: { 
          name: name.trim(), 
          email: email.trim(),
          phone: phone.trim(),
          address: address ? address.trim() : 'Store Pickup'
        },
        items: cartItems,
        delivery: { 
          date: delivery_date 
        },
        payment: { 
          subtotal: parseFloat(subtotal),
          total: parseFloat(total) 
        }
      };

      // Send confirmation email to customer
      sendOrderConfirmation(orderData);

      // Admin notifications are handled via in-app notification system in the dashboard
      // Email notifications to admin are disabled to prevent spam
      // To re-enable: uncomment the line below and set ADMIN_EMAIL environment variable
      // sendAdminNotification(orderData);

      res.json({
        success: true,
        order_id: orderId,
        message: 'Order received successfully'
      });
    });

    stmt.finalize();

  } catch (error) {
    console.error('Order processing error:', error);
    
    // Clean up uploaded file if order processing fails
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting uploaded file:', err);
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to process order',
      message: 'Please try again or contact us directly'
    });
  }
});

// Get order status (for customer lookup)
app.get('/api/orders/:orderId', (req, res) => {
  db.get(
    `SELECT * FROM orders WHERE id = ?`,
    [req.params.orderId],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Don't expose sensitive information
      const publicOrder = {
        id: row.id,
        customer: {
          name: row.customer_name,
          email: row.customer_email
        },
        items: JSON.parse(row.cart_items),
        delivery: {
          date: row.delivery_date,
          fee: row.delivery_fee
        },
        payment: {
          subtotal: row.subtotal,
          total: row.total
        },
        status: row.status,
        created_at: row.created_at
      };
      
      res.json(publicOrder);
    }
  );
});

// Admin endpoint to get all orders
app.get('/api/admin/orders', authenticateAdmin, (req, res) => {
  db.all(
    `SELECT * FROM orders ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(rows);
    }
  );
});

// Update order status (admin only)
app.patch('/api/admin/orders/:orderId', authenticateAdmin, (req, res) => {
  const { status } = req.body;
  
  // Validate status
  const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  db.run(
    `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, req.params.orderId],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      res.json({ success: true, message: 'Order status updated' });
    }
  );
});

// Export orders to Excel (admin only)
app.get('/api/admin/orders/export', authenticateAdmin, (req, res) => {
  db.all(
    `SELECT * FROM orders ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      try {
        const phpCurrency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
        // Prepare data for Excel export
        const excelData = rows.map(order => {
          let parsed;
          try {
            parsed = JSON.parse(order.cart_items);
          } catch (_) {
            parsed = [];
          }
          const cartItems = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
          const itemsList = cartItems.map(item => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;
            return `${item.title} (Qty: ${qty}, ₱${price.toFixed(2)})`;
          }).join('; ');
          
          return {
            'Order ID': order.id,
            'Customer Name': order.customer_name,
            'Customer Email': order.customer_email,
            'Customer Phone': order.customer_phone,
            'Customer Address': order.customer_address,
            'Customer Instagram': order.customer_instagram || '',
            'Customer Notes': order.customer_notes || '',
            'Pickup Date': new Date(order.delivery_date).toLocaleDateString(),
            'Order Date': new Date(order.created_at).toLocaleString(),
            'Items': itemsList,
            'Total': phpCurrency.format(parseFloat(order.total) || 0),
            'Status': order.status.charAt(0).toUpperCase() + order.status.slice(1),
            'Payment Proof': order.payment_proof
          };
        });
        
        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        
        // Set column widths
        const columnWidths = [
          { wch: 12 }, // Order ID
          { wch: 20 }, // Customer Name
          { wch: 30 }, // Customer Email
          { wch: 15 }, // Customer Phone
          { wch: 40 }, // Customer Address
          { wch: 30 }, // Customer Notes
          { wch: 15 }, // Delivery Date
          { wch: 20 }, // Order Date
          { wch: 60 }, // Items
          { wch: 12 }, // Subtotal
          { wch: 12 }, // Delivery Fee
          { wch: 12 }, // Total
          { wch: 12 }, // Status
          { wch: 25 }  // Payment Proof
        ];
        worksheet['!cols'] = columnWidths;
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
        
        // Generate Excel file buffer
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        // Set response headers for file download
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `sweets-by-toni-orders-${timestamp}.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', excelBuffer.length);
        
        // Send the Excel file
        res.send(excelBuffer);
        
        console.log(`📊 Excel export completed: ${rows.length} orders exported to ${filename}`);
        
      } catch (error) {
        console.error('Excel export error:', error);
        res.status(500).json({ error: 'Failed to generate Excel file' });
      }
    }
  );
});

// Email receipt function
async function sendOrderConfirmation(order) {
  // If email is not configured, just log and return
  if (!emailService) {
    console.log(`📧 Email not configured - skipping confirmation email to ${order.customer.email}`);
    console.log(`Order ID: ${order.id} | Total: ₱${order.payment.total}`);
    return;
  }

  try {
    const phpCurrency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
    
    // Parse cart items to display in email
    let cartItemsHTML = '';
    let itemsList = [];
    
    if (order.items) {
      const items = Array.isArray(order.items) ? order.items : Object.values(order.items || {});
      itemsList = items.map(item => {
        const qty = Number(item.quantity || item.qty || 0);
        const price = Number(item.price || 0);
        const subtotal = qty * price;
        
        cartItemsHTML += `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 16px 12px; color: #374151;">${item.title || 'Item'}</td>
            <td style="padding: 16px 12px; text-align: center; color: #6b7280;">${qty}</td>
            <td style="padding: 16px 12px; text-align: right; color: #374151;">${phpCurrency.format(price)}</td>
            <td style="padding: 16px 12px; text-align: right; color: #374151; font-weight: 600;">${phpCurrency.format(subtotal)}</td>
          </tr>
        `;
        
        return { title: item.title, qty, price: phpCurrency.format(price) };
      });
    }

    // Create beautiful HTML email template
    const emailHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation - Sweets by Toni</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    
    <!-- Header with Logo -->
    <div style="background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
        🧁 Sweets by Toni
      </h1>
      <p style="margin: 10px 0 0 0; color: #fce7f3; font-size: 16px;">
        Order Confirmation
      </p>
    </div>

    <!-- Success Message -->
    <div style="padding: 30px; text-align: center; background-color: #f0fdf4; border-bottom: 1px solid #bbf7d0;">
      <div style="width: 60px; height: 60px; background-color: #22c55e; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
        <span style="color: #ffffff; font-size: 32px; line-height: 1;">✓</span>
      </div>
      <h2 style="margin: 0; color: #166534; font-size: 24px; font-weight: 600;">
        Order Received Successfully!
      </h2>
      <p style="margin: 12px 0 0 0; color: #15803d; font-size: 14px;">
        Thank you for your order! We've received your payment and will prepare your delicious treats with love.
      </p>
    </div>

    <!-- Order Details -->
    <div style="padding: 30px;">
      
      <!-- Order ID Section -->
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 30px; border-radius: 4px;">
        <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
          Order ID
        </p>
        <p style="margin: 8px 0 0 0; color: #78350f; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">
          ${order.id}
        </p>
      </div>

      <!-- Customer Information -->
      <div style="margin-bottom: 30px;">
        <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 18px; font-weight: 600; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
          Customer Information
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 40%;">Name:</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${order.customer.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email:</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${order.customer.email}</td>
          </tr>
          ${order.delivery && order.delivery.date ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Pickup Date:</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${new Date(order.delivery.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <!-- Order Items -->
      <div style="margin-bottom: 30px;">
        <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 18px; font-weight: 600; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
          Order Items
        </h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #f9fafb;">
              <th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Product</th>
              <th style="padding: 12px; text-align: center; font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
              <th style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Price</th>
              <th style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${cartItemsHTML}
          </tbody>
        </table>
      </div>

      <!-- Order Summary -->
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Subtotal:</td>
            <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px; font-weight: 600;">${phpCurrency.format(order.payment.total)}</td>
          </tr>
          <tr style="border-top: 2px solid #e5e7eb;">
            <td style="padding: 12px 0 0 0; color: #111827; font-size: 18px; font-weight: 700;">Total:</td>
            <td style="padding: 12px 0 0 0; text-align: right; color: #ec4899; font-size: 24px; font-weight: 700;">${phpCurrency.format(order.payment.total)}</td>
          </tr>
        </table>
      </div>

      <!-- Next Steps -->
      <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 16px; font-weight: 600;">
          📋 What's Next?
        </h3>
        <ol style="margin: 0; padding-left: 20px; color: #1e3a8a; font-size: 14px; line-height: 1.8;">
          <li>We've received your payment and order details</li>
          <li>We'll prepare your order with care and love</li>
          <li>You'll receive a confirmation when your order is ready</li>
          <li>Pick up your order on the scheduled date</li>
        </ol>
      </div>

      <!-- Contact Information -->
      <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
          Questions about your order?
        </p>
        <p style="margin: 0; color: #111827; font-size: 14px; font-weight: 600;">
          Contact us and we'll be happy to help!
        </p>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">
        This is an automated confirmation email from Sweets by Toni
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        © ${new Date().getFullYear()} Sweets by Toni. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
    `;

    // Plain text version for email clients that don't support HTML
    const itemsText = itemsList.map(item => `  - ${item.title} (Qty: ${item.qty}) - ${item.price}`).join('\n');
    const plainTextEmail = `
SWEETS BY TONI - ORDER CONFIRMATION
====================================

✓ Order Received Successfully!

Thank you for your order! We've received your payment and will prepare your delicious treats with love.

ORDER DETAILS
-------------
Order ID: ${order.id}

CUSTOMER INFORMATION
--------------------
Name: ${order.customer.name}
Email: ${order.customer.email}
${order.delivery && order.delivery.date ? `Pickup Date: ${new Date(order.delivery.date).toLocaleDateString()}` : ''}

ORDER ITEMS
-----------
${itemsText}

ORDER SUMMARY
-------------
Total: ${phpCurrency.format(order.payment.total)}

WHAT'S NEXT?
------------
1. We've received your payment and order details
2. We'll prepare your order with care and love
3. You'll receive a confirmation when your order is ready
4. Pick up your order on the scheduled date

Questions about your order? Contact us and we'll be happy to help!

---
This is an automated confirmation email from Sweets by Toni
© ${new Date().getFullYear()} Sweets by Toni. All rights reserved.
    `;

    // Send the email using the configured service
    if (emailService === 'sendgrid') {
      // SendGrid API
      const msg = {
        to: order.customer.email,
        from: {
          email: EMAIL_CONFIG.sendgridFromEmail,
          name: EMAIL_CONFIG.sendgridFromName
        },
        subject: `Order Confirmation - ${order.id} - Sweets by Toni`,
        text: plainTextEmail,
        html: emailHTML
      };
      
      await sgMail.send(msg);
      console.log(`✅ Confirmation email sent via SendGrid to ${order.customer.email} (Order: ${order.id})`);
      
    } else if (emailService === 'nodemailer') {
      // Nodemailer (Gmail/Outlook/etc)
      const mailOptions = {
        from: EMAIL_CONFIG.from,
        to: order.customer.email,
        subject: `Order Confirmation - ${order.id} - Sweets by Toni`,
        text: plainTextEmail,
        html: emailHTML
      };
      
      await emailTransporter.sendMail(mailOptions);
      console.log(`✅ Confirmation email sent via ${EMAIL_CONFIG.service} to ${order.customer.email} (Order: ${order.id})`);
    }
    
  } catch (error) {
    console.error(`❌ Failed to send confirmation email to ${order.customer.email}:`, error.message);
    // Don't throw error - we don't want to fail the order if email fails
  }
}

// Admin notification function for new orders
async function sendAdminNotification(order) {
  // If email is not configured or no admin email set, just log and return
  if (!emailTransporter || !EMAIL_CONFIG.adminEmail) {
    console.log(`📧 Admin email not configured - skipping admin notification for order ${order.id}`);
    return;
  }

  try {
    const phpCurrency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
    
    // Parse cart items for display
    let cartItemsHTML = '';
    let itemsList = [];
    let totalItems = 0;
    
    if (order.items) {
      const items = Array.isArray(order.items) ? order.items : Object.values(order.items || {});
      itemsList = items.map(item => {
        const qty = Number(item.quantity || item.qty || 0);
        const price = Number(item.price || 0);
        const subtotal = qty * price;
        totalItems += qty;
        
        cartItemsHTML += `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px 8px; color: #374151; font-size: 14px;">${item.title || 'Item'}</td>
            <td style="padding: 12px 8px; text-align: center; color: #6b7280; font-size: 14px;">${qty}</td>
            <td style="padding: 12px 8px; text-align: right; color: #374151; font-size: 14px;">${phpCurrency.format(price)}</td>
            <td style="padding: 12px 8px; text-align: right; color: #374151; font-weight: 600; font-size: 14px;">${phpCurrency.format(subtotal)}</td>
          </tr>
        `;
        
        return { title: item.title, qty, price: phpCurrency.format(price) };
      });
    }

    // Create admin notification email
    const emailHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Order Alert - ${order.id}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center;">
      <div style="background-color: rgba(255,255,255,0.15); border-radius: 50%; width: 80px; height: 80px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
        <span style="font-size: 40px;">🔔</span>
      </div>
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
        New Order Received!
      </h1>
      <p style="margin: 10px 0 0 0; color: #dbeafe; font-size: 14px;">
        Order ID: ${order.id}
      </p>
    </div>

    <!-- Quick Stats -->
    <div style="display: flex; padding: 20px 30px; background-color: #fef3c7; border-bottom: 2px solid #f59e0b;">
      <div style="flex: 1; text-align: center; padding: 10px;">
        <div style="font-size: 28px; font-weight: 700; color: #92400e;">${phpCurrency.format(order.payment.total)}</div>
        <div style="font-size: 12px; color: #78350f; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Total Amount</div>
      </div>
      <div style="flex: 1; text-align: center; padding: 10px; border-left: 1px solid #fbbf24;">
        <div style="font-size: 28px; font-weight: 700; color: #92400e;">${totalItems}</div>
        <div style="font-size: 12px; color: #78350f; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Items</div>
      </div>
      <div style="flex: 1; text-align: center; padding: 10px; border-left: 1px solid #fbbf24;">
        <div style="font-size: 28px; font-weight: 700; color: #92400e;">📅</div>
        <div style="font-size: 12px; color: #78350f; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Pickup Date</div>
      </div>
    </div>

    <!-- Order Details -->
    <div style="padding: 30px;">
      
      <!-- Customer Information -->
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
        <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
          👤 Customer Details
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 14px; width: 35%;">Name:</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600;">${order.customer.name}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Email:</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600;"><a href="mailto:${order.customer.email}" style="color: #2563eb; text-decoration: none;">${order.customer.email}</a></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Phone:</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600;"><a href="tel:${order.customer.phone}" style="color: #2563eb; text-decoration: none;">${order.customer.phone}</a></td>
          </tr>
          ${order.customer.address ? `
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Address:</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600;">${order.customer.address}</td>
          </tr>
          ` : ''}
          ${order.delivery && order.delivery.date ? `
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Pickup Date:</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600;">${new Date(order.delivery.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <!-- Order Items -->
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
          🛍️ Order Items
        </h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #f9fafb;">
              <th style="padding: 12px 8px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Product</th>
              <th style="padding: 12px 8px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Qty</th>
              <th style="padding: 12px 8px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Price</th>
              <th style="padding: 12px 8px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${cartItemsHTML}
          </tbody>
          <tfoot>
            <tr style="background-color: #fef3c7; border-top: 2px solid #f59e0b;">
              <td colspan="3" style="padding: 16px 8px; text-align: right; font-size: 16px; font-weight: 700; color: #78350f;">Order Total:</td>
              <td style="padding: 16px 8px; text-align: right; font-size: 20px; font-weight: 700; color: #92400e;">${phpCurrency.format(order.payment.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="http://localhost:3000/admin-dashboard.html" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);">
          View Order in Dashboard →
        </a>
      </div>

      <!-- Quick Actions -->
      <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin-top: 24px;">
        <h4 style="margin: 0 0 12px 0; color: #1e40af; font-size: 14px; font-weight: 600;">⚡ Quick Actions Needed:</h4>
        <ul style="margin: 0; padding-left: 20px; color: #1e3a8a; font-size: 14px; line-height: 1.8;">
          <li>Review payment proof</li>
          <li>Confirm product availability</li>
          <li>Update order status to "Confirmed"</li>
          <li>Prepare items for pickup date</li>
        </ul>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">
        Order received at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })}
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        This is an automated admin notification from Sweets by Toni
      </p>
    </div>

  </div>
</body>
</html>
    `;

    // Plain text version
    const itemsText = itemsList.map(item => `  - ${item.title} (Qty: ${item.qty}) - ${item.price}`).join('\n');
    const plainTextEmail = `
🔔 NEW ORDER RECEIVED - Sweets by Toni
========================================

Order ID: ${order.id}
Order Total: ${phpCurrency.format(order.payment.total)}
Total Items: ${totalItems}

CUSTOMER DETAILS
----------------
Name: ${order.customer.name}
Email: ${order.customer.email}
Phone: ${order.customer.phone}
${order.customer.address ? `Address: ${order.customer.address}` : ''}
${order.delivery && order.delivery.date ? `Pickup Date: ${new Date(order.delivery.date).toLocaleDateString()}` : ''}

ORDER ITEMS
-----------
${itemsText}

Order Total: ${phpCurrency.format(order.payment.total)}

QUICK ACTIONS NEEDED
--------------------
- Review payment proof
- Confirm product availability
- Update order status to "Confirmed"
- Prepare items for pickup date

View full order details in the admin dashboard:
http://localhost:3000/admin-dashboard.html

---
Order received at ${new Date().toLocaleString()}
This is an automated admin notification from Sweets by Toni
    `;

    // Send admin notification
    const mailOptions = {
      from: EMAIL_CONFIG.from,
      to: EMAIL_CONFIG.adminEmail,
      subject: `🔔 New Order ${order.id} - ${phpCurrency.format(order.payment.total)} - Sweets by Toni`,
      text: plainTextEmail,
      html: emailHTML
    };

    await emailTransporter.sendMail(mailOptions);
    console.log(`✅ Admin notification sent successfully to ${EMAIL_CONFIG.adminEmail} (Order: ${order.id})`);
    
  } catch (error) {
    console.error(`❌ Failed to send admin notification:`, error.message);
    // Don't throw error - we don't want to fail the order if email fails
  }
}

// Available Dates Management API
// Get all available dates
app.get('/api/admin/available-dates', authenticateAdmin, async (req, res) => {
  try {
    const availableDates = await readAvailableDates();
    res.json({ success: true, dates: availableDates });
  } catch (error) {
    console.error('Error reading available dates:', error);
    res.status(500).json({ error: 'Failed to load available dates' });
  }
});

// Add new available date
app.post('/api/admin/available-dates', authenticateAdmin, async (req, res) => {
  try {
    console.log('Received request to add available date:', req.body);
    const { type, date, totalSlots, notes } = req.body;
    
    // Validate input
    if (!type || !date || !totalSlots) {
      console.log('Validation failed - missing fields:', { type, date, totalSlots });
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (type !== 'pickup') {
      console.log('Invalid type:', type);
      return res.status(400).json({ error: 'Invalid type. Only pickup is supported' });
    }
    
    if (totalSlots < 1 || totalSlots > 50) {
      console.log('Invalid slots:', totalSlots);
      return res.status(400).json({ error: 'Total slots must be between 1 and 50' });
    }
    
    // Validate date format and ensure it's not in the past
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      console.log('Invalid date format:', date);
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj < today) {
      console.log('Date in past:', date);
      return res.status(400).json({ error: 'Cannot add dates in the past' });
    }
    
    const dateId = `date-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Check for duplicate date in database
    const existingDate = await dbGet(
      'SELECT id FROM available_dates WHERE type = ? AND date = ?',
      [type, date]
    );
    
    if (existingDate) {
      console.log('Duplicate date found:', date);
      return res.status(400).json({ error: 'Date already exists for this type' });
    }
    
    const newDate = {
      id: dateId,
      type: type,
      date: date,
      totalSlots: parseInt(totalSlots),
      remainingSlots: parseInt(totalSlots),
      notes: notes || '',
      createdAt: new Date().toISOString()
    };
    
    console.log('Adding new date to database:', newDate);
    await createAvailableDate(newDate);
    
    console.log('Successfully added date');
    res.json({ success: true, date: newDate });
  } catch (error) {
    console.error('Error adding available date:', error);
    res.status(500).json({ error: 'Failed to add available date' });
  }
});

// Update available date
app.put('/api/admin/available-dates/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { totalSlots, notes } = req.body;
    
    if (totalSlots && (totalSlots < 1 || totalSlots > 50)) {
      return res.status(400).json({ error: 'Total slots must be between 1 and 50' });
    }
    
    // Get current date from database
    const currentDate = await dbGet('SELECT * FROM available_dates WHERE id = ?', [id]);
    
    if (!currentDate) {
      return res.status(404).json({ error: 'Date not found' });
    }
    
    // Calculate new remaining slots if total slots changed
    const updates = {};
    if (totalSlots) {
      const usedSlots = currentDate.total_slots - currentDate.remaining_slots;
      const newRemainingSlots = Math.max(0, totalSlots - usedSlots);
      updates.totalSlots = totalSlots;
      updates.remainingSlots = newRemainingSlots;
    }
    if (notes !== undefined) {
      updates.notes = notes;
    }
    
    await updateAvailableDate(id, updates);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating available date:', error);
    res.status(500).json({ error: 'Failed to update available date' });
  }
});

// Delete available date
app.delete('/api/admin/available-dates/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if date exists
    const existingDate = await dbGet('SELECT id FROM available_dates WHERE id = ?', [id]);
    
    if (!existingDate) {
      return res.status(404).json({ error: 'Date not found' });
    }
    
    await deleteAvailableDate(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting available date:', error);
    res.status(500).json({ error: 'Failed to delete available date' });
  }
});

// Stock validation endpoint
app.post('/api/validate-stock', async (req, res) => {
  try {
    const { productId, requestedQty } = req.body;
    
    if (!productId || !requestedQty) {
      return res.status(400).json({ error: 'Missing productId or requestedQty' });
    }
    
    const product = await getProductByIdFromDb(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    let availableStock = 0;
    let productTitle = product.title;
    
    // Check if this is a variant ID
    if (product.hasVariants && product.variants) {
      const variant = product.variants.find(v => v.id === productId);
      if (variant) {
        availableStock = variant.stock || 0;
        productTitle = `${product.title} - ${variant.name}`;
      } else {
        // If not found as variant, use main product stock
        availableStock = product.stock || 0;
      }
    } else {
      // Regular product
      availableStock = product.stock || 0;
    }
    
    const isValid = requestedQty <= availableStock;
    
    res.json({
      success: true,
      isValid,
      available: isValid, // Add this for frontend compatibility
      availableStock,
      requestedQty,
      productId,
      message: isValid ? 'Stock available' : `Only ${availableStock} unit(s) available in stock.`
    });
  } catch (error) {
    console.error('Error validating stock:', error);
    res.status(500).json({ error: 'Failed to validate stock' });
  }
});

// Get stock for a specific product
app.get('/api/stock/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await getProductByIdFromDb(productId);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    let availableStock = 0;
    let productTitle = product.title;
    
    // Check if this is a variant ID
    if (product.hasVariants && product.variants) {
      const variant = product.variants.find(v => v.id === productId);
      if (variant) {
        availableStock = variant.stock || 0;
        productTitle = `${product.title} - ${variant.name}`;
      } else {
        // If not found as variant, use main product stock
        availableStock = product.stock || 0;
      }
    } else {
      // Regular product
      availableStock = product.stock || 0;
    }
    
    res.json({
      success: true,
      productId,
      stock: availableStock,
      title: productTitle
    });
  } catch (error) {
    console.error('Error getting stock:', error);
    res.status(500).json({ error: 'Failed to get stock' });
  }
});

// Get available dates for customers (public endpoint)
app.get('/api/available-dates', async (req, res) => {
  try {
    const availableDates = await readAvailableDates();
    const today = new Date().toISOString().split('T')[0];
    
    // Filter out past dates and return only future dates
    const filteredDates = {
      pickup: availableDates.pickup.filter(d => d.date >= today)
    };
    
    res.json({ success: true, dates: filteredDates });
  } catch (error) {
    console.error('Error reading available dates:', error);
    res.status(500).json({ error: 'Failed to load available dates' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
  }
  
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🍰 Sweets by Toni Server running on http://localhost:${PORT}`);
  console.log(`📁 Uploads directory: ./uploads/payment-proofs`);
  console.log(`📊 Orders endpoint: /api/orders`);
  console.log(`🔍 Order lookup: /api/orders/:orderId`);
  // One-time migration from products.json if DB is empty
  (async () => {
    try{
      // 1. Migrate products from JSON
      const countRow = await dbGet(`SELECT COUNT(*) as c FROM products`);
      if((countRow?.c || 0) === 0 && fs.existsSync(PRODUCTS_PATH)){
        const raw = fs.readFileSync(PRODUCTS_PATH, 'utf8');
        const list = JSON.parse(raw || '[]');
        if(Array.isArray(list) && list.length > 0){
          console.log(`📦 Migrating ${list.length} products from JSON to DB...`);
          for(const p of list){
            await upsertProductToDb(p);
          }
          console.log('✅ Products migration complete.');
        }
      }
      
      // 2. Migrate available dates from JSON
      const datesCount = await dbGet(`SELECT COUNT(*) as c FROM available_dates`);
      const DATES_JSON_PATH = path.join(__dirname, 'available-dates.json');
      if((datesCount?.c || 0) === 0 && fs.existsSync(DATES_JSON_PATH)){
        const datesRaw = fs.readFileSync(DATES_JSON_PATH, 'utf8');
        const datesData = JSON.parse(datesRaw || '{}');
        let migratedCount = 0;
        
        // Migrate pickup dates
        if(Array.isArray(datesData.pickup)){
          for(const date of datesData.pickup){
            await createAvailableDate({
              id: date.id,
              type: 'pickup',
              date: date.date,
              totalSlots: date.totalSlots || date.total_slots || 0,
              notes: date.notes || ''
            });
            // Set remaining slots if different from total
            if(date.remainingSlots !== undefined || date.remaining_slots !== undefined){
              const remaining = date.remainingSlots || date.remaining_slots;
              await updateAvailableDate(date.id, { remainingSlots: remaining });
            }
            migratedCount++;
          }
        }
        
        // Migrate delivery dates
        if(Array.isArray(datesData.delivery)){
          for(const date of datesData.delivery){
            await createAvailableDate({
              id: date.id,
              type: 'delivery',
              date: date.date,
              totalSlots: date.totalSlots || date.total_slots || 0,
              notes: date.notes || ''
            });
            if(date.remainingSlots !== undefined || date.remaining_slots !== undefined){
              const remaining = date.remainingSlots || date.remaining_slots;
              await updateAvailableDate(date.id, { remainingSlots: remaining });
            }
            migratedCount++;
          }
        }
        
        if(migratedCount > 0){
          console.log(`✅ Migrated ${migratedCount} available dates to database`);
          // Backup the JSON file
          const backupPath = DATES_JSON_PATH + '.migrated.backup';
          fs.copyFileSync(DATES_JSON_PATH, backupPath);
          console.log(`📁 Original JSON backed up to: ${backupPath}`);
        }
      }
      
      // 3. Migrate product limits from JSON
      const limitsCount = await dbGet(`SELECT COUNT(*) as c FROM product_limits`);
      if((limitsCount?.c || 0) === 0 && fs.existsSync(PRODUCT_LIMITS_PATH)){
        const limitsRaw = fs.readFileSync(PRODUCT_LIMITS_PATH, 'utf8');
        const limitsData = JSON.parse(limitsRaw || '{}');
        let migratedLimitsCount = 0;
        
        for(const [productId, maxQty] of Object.entries(limitsData)){
          if(typeof maxQty === 'number' && maxQty > 0){
            await setProductLimit(productId, maxQty, 'migration');
            migratedLimitsCount++;
          }
        }
        
        if(migratedLimitsCount > 0){
          console.log(`✅ Migrated ${migratedLimitsCount} product limits to database`);
          // Backup the JSON file
          const backupPath = PRODUCT_LIMITS_PATH + '.migrated.backup';
          fs.copyFileSync(PRODUCT_LIMITS_PATH, backupPath);
          console.log(`📁 Original JSON backed up to: ${backupPath}`);
        }
      }
      
      console.log('🎉 All data migrations complete');
    } catch(e){
      console.warn('Migration error:', e?.message || e);
    }
  })();
});

module.exports = app;
