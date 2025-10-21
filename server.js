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

const app = express();
const PORT = process.env.PORT || 3000;

// Admin credentials (in production, use environment variables)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sweetsbytoni2024';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
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

// Simple JSON storage for product limits
const PRODUCT_LIMITS_PATH = path.join(__dirname, 'product-limits.json');
function readProductLimits(){
  try{
    if(!fs.existsSync(PRODUCT_LIMITS_PATH)){
      fs.writeFileSync(PRODUCT_LIMITS_PATH, JSON.stringify({}), 'utf8');
    }
    const raw = fs.readFileSync(PRODUCT_LIMITS_PATH, 'utf8');
    const data = JSON.parse(raw || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch(e){
    console.error('Failed to read product limits:', e);
    return {};
  }
}
function writeProductLimits(limits){
  try{
    fs.writeFileSync(PRODUCT_LIMITS_PATH, JSON.stringify(limits || {}, null, 2), 'utf8');
    return true;
  } catch(e){
    console.error('Failed to write product limits:', e);
    return false;
  }
}

// Available dates helper functions
function readAvailableDates() {
  try {
    if (fs.existsSync('available-dates.json')) {
      const data = fs.readFileSync('available-dates.json', 'utf8');
      return JSON.parse(data);
    }
    return { pickup: [] };
  } catch (e) {
    console.error('Failed to read available dates:', e);
    return { pickup: [] };
  }
}

function writeAvailableDates(dates) {
  try {
    fs.writeFileSync('available-dates.json', JSON.stringify(dates, null, 2));
    return true;
  } catch (e) {
    console.error('Failed to write available dates:', e);
    return false;
  }
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
app.get('/api/product-limits', (req, res) => {
  const limits = readProductLimits();
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
      sameSite: 'lax',
      secure: false, // set to true over HTTPS
      path: '/',
      maxAge: 24 * 60 * 60 * 1000
    });
    console.log('Admin login successful, cookie set.');
    return res.json({ success: true, message: 'Login successful', token });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

// Admin endpoints to manage per-product quantity limits
app.get('/api/admin/product-limits', authenticateAdmin, (req, res) => {
  const limits = readProductLimits();
  res.json({ limits });
});

app.put('/api/admin/product-limits', authenticateAdmin, (req, res) => {
  try{
    const body = req.body || {};
    const incoming = body.limits;
    if(!incoming || typeof incoming !== 'object'){
      return res.status(400).json({ error: 'Invalid payload: expected { limits: { [productId]: number } }' });
    }
    const current = readProductLimits();
    const updated = { ...current };
    for(const [id, val] of Object.entries(incoming)){
      const n = Number(val);
      if(Number.isFinite(n) && n >= 0){
        updated[id] = n;
      }
    }
    if(!writeProductLimits(updated)){
      return res.status(500).json({ error: 'Failed to persist product limits' });
    }
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
    const { name, email, phone, delivery_date, address, instagram, cart, order_id_prefix, subtotal, total } = req.body;
    
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
    
    // Decrement remaining slots for the selected pickup date
    try {
      const availableDates = readAvailableDates();
      const pickupDateIndex = availableDates.pickup.findIndex(d => d.date === delivery_date);
      
      if (pickupDateIndex !== -1) {
        const currentDate = availableDates.pickup[pickupDateIndex];
        availableDates.pickup[pickupDateIndex] = {
          ...currentDate,
          remainingSlots: Math.max(0, currentDate.remainingSlots - 1),
          updatedAt: new Date().toISOString()
        };
        writeAvailableDates(availableDates);
        console.log(`📅 Decremented slots for ${delivery_date}: ${currentDate.remainingSlots} -> ${currentDate.remainingSlots - 1}`);
      }
    } catch (error) {
      console.error('Error decrementing slots:', error);
      // Don't fail the order if slot update fails
    }

    // Save order to database
    const stmt = db.prepare(`
      INSERT INTO orders (
        id, customer_name, customer_email, customer_phone, customer_address,
        customer_instagram, customer_notes, delivery_date, delivery_fee, subtotal, total,
        payment_proof, payment_proof_path, cart_items, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

      // Send confirmation email (placeholder)
      sendOrderConfirmation({
        id: orderId,
        customer: { name: name.trim(), email: email.trim() },
        payment: { total: parseFloat(total) }
      });

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

// Placeholder email function
async function sendOrderConfirmation(order) {
  // In a real application, use a service like:
  // - SendGrid
  // - Mailgun
  // - AWS SES
  // - Nodemailer with SMTP
  
  console.log(`📧 Sending confirmation email to ${order.customer.email}`);
  console.log(`Order ID: ${order.id}`);
  console.log(`Total: ₱${order.payment.total}`);
  
  // Email template would include:
  // - Order details
  // - Delivery information
  // - Contact information
  // - Payment confirmation
}

// Available Dates Management API
// Get all available dates
app.get('/api/admin/available-dates', authenticateAdmin, (req, res) => {
  try {
    const availableDates = readAvailableDates();
    res.json({ success: true, dates: availableDates });
  } catch (error) {
    console.error('Error reading available dates:', error);
    res.status(500).json({ error: 'Failed to load available dates' });
  }
});

// Add new available date
app.post('/api/admin/available-dates', authenticateAdmin, (req, res) => {
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
    
    console.log('Reading available dates...');
    const availableDates = readAvailableDates();
    console.log('Current available dates:', availableDates);
    
    const dateId = `date-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Check for duplicate date
    if (availableDates[type].some(d => d.date === date)) {
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
    
    console.log('Adding new date:', newDate);
    availableDates[type].push(newDate);
    
    // Sort dates by date
    availableDates[type].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    console.log('Writing available dates...');
    const writeResult = writeAvailableDates(availableDates);
    console.log('Write result:', writeResult);
    
    if (!writeResult) {
      return res.status(500).json({ error: 'Failed to save available dates' });
    }
    
    console.log('Successfully added date');
    res.json({ success: true, date: newDate });
  } catch (error) {
    console.error('Error adding available date:', error);
    res.status(500).json({ error: 'Failed to add available date' });
  }
});

// Update available date
app.put('/api/admin/available-dates/:id', authenticateAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { totalSlots, notes } = req.body;
    
    if (totalSlots && (totalSlots < 1 || totalSlots > 50)) {
      return res.status(400).json({ error: 'Total slots must be between 1 and 50' });
    }
    
    const availableDates = readAvailableDates();
    let found = false;
    
    const dateIndex = availableDates.pickup.findIndex(d => d.id === id);
    if (dateIndex !== -1) {
      const date = availableDates.pickup[dateIndex];
      const newTotalSlots = totalSlots || date.totalSlots;
      const usedSlots = date.totalSlots - date.remainingSlots;
      const newRemainingSlots = Math.max(0, newTotalSlots - usedSlots);
      
      availableDates.pickup[dateIndex] = {
        ...date,
        totalSlots: newTotalSlots,
        remainingSlots: newRemainingSlots,
        notes: notes !== undefined ? notes : date.notes,
        updatedAt: new Date().toISOString()
      };
      
      found = true;
    }
    
    if (!found) {
      return res.status(404).json({ error: 'Date not found' });
    }
    
    writeAvailableDates(availableDates);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating available date:', error);
    res.status(500).json({ error: 'Failed to update available date' });
  }
});

// Delete available date
app.delete('/api/admin/available-dates/:id', authenticateAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const availableDates = readAvailableDates();
    let found = false;
    
    const dateIndex = availableDates.pickup.findIndex(d => d.id === id);
    if (dateIndex !== -1) {
      availableDates.pickup.splice(dateIndex, 1);
      found = true;
    }
    
    if (!found) {
      return res.status(404).json({ error: 'Date not found' });
    }
    
    writeAvailableDates(availableDates);
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
app.get('/api/available-dates', (req, res) => {
  try {
    const availableDates = readAvailableDates();
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
      const countRow = await dbGet(`SELECT COUNT(*) as c FROM products`);
      if((countRow?.c || 0) === 0 && fs.existsSync(PRODUCTS_PATH)){
        const raw = fs.readFileSync(PRODUCTS_PATH, 'utf8');
        const list = JSON.parse(raw || '[]');
        if(Array.isArray(list) && list.length > 0){
          console.log(`Migrating ${list.length} products from JSON to DB...`);
          for(const p of list){
            await upsertProductToDb(p);
          }
          console.log('Migration complete.');
        }
      }
    } catch(e){
      console.warn('Products migration skipped/failed:', e?.message || e);
    }
  })();
});

module.exports = app;
