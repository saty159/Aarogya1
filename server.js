const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const path = require('path');
const pdfParse = require('pdf-parse');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const webPush = require('web-push');

// Load environment variables
dotenv.config();

// VAPID keys for Web Push
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(
    'mailto:support@aarogya.in',
    vapidPublicKey,
    vapidPrivateKey
  );
}

const app = express();
const PORT = process.env.PORT || 5000;
const API_KEY = process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'aarogya_secret_key_2026';

const { Pool } = require('pg');

// PostgreSQL Database configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.ruqpnzakeltscxfhbxfs:%40Nikhil2262@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres';
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize Database Tables
async function initDB() {
  try {
    // Migration: Ensure columns exist for existing tables (Run first to avoid issues)
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscription TEXT;');
    await pool.query('ALTER TABLE reminders ADD COLUMN IF NOT EXISTS remind_at TIMESTAMP;');
    await pool.query('ALTER TABLE reminders ADD COLUMN IF NOT EXISTS notified BOOLEAN DEFAULT FALSE;');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        push_subscription TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        medicine_name TEXT NOT NULL,
        dosage TEXT,
        note TEXT,
        remind_at TIMESTAMP,
        notified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Database tables and migrations initialized');
  } catch (err) {
    console.error('❌ Database initialization failed:', err);
  }
}
initDB();

// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static('.'));

// Auth Endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const checkUser = await pool.query('SELECT email FROM users WHERE email = $1', [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const insertUser = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name || email]
    );
    const newUser = insertUser.rows[0];

    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ success: true, token, user: { email: newUser.email, name: newUser.name } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const fetchUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = fetchUser.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, user: { email: user.email, name: user.name } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Reminder Endpoints
app.post('/api/reminders', authenticateToken, async (req, res) => {
  try {
    const { medicine_name, dosage, note, remind_at } = req.body;
    if (!medicine_name) return res.status(400).json({ error: 'Medicine name is required' });

    const result = await pool.query(
      'INSERT INTO reminders (user_id, medicine_name, dosage, note, remind_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, medicine_name, dosage, note, remind_at]
    );
    res.status(201).json({ success: true, reminder: result.rows[0] });
  } catch (error) {
    console.error('Failed to create reminder:', error);
    res.status(500).json({ error: 'Failed to save reminder' });
  }
});

app.get('/api/reminders', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM reminders WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ success: true, reminders: result.rows });
  } catch (error) {
    console.error('Failed to fetch reminders:', error);
    res.status(500).json({ error: 'Failed to load reminders' });
  }
});

app.delete('/api/reminders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM reminders WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ success: true, message: 'Reminder deleted' });
  } catch (error) {
    console.error('Failed to delete reminder:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

// Push Subscription Endpoint
app.post('/api/push/subscribe', authenticateToken, async (req, res) => {
  try {
    const { subscription } = req.body;
    await pool.query(
      'UPDATE users SET push_subscription = $1 WHERE id = $2',
      [JSON.stringify(subscription), req.user.id]
    );
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// Background Reminder Checker (runs every 60 seconds)
setInterval(async () => {
  try {
    const now = new Date();
    // Get reminders that are due and haven't been notified yet
    const dueReminders = await pool.query(`
      SELECT r.*, u.push_subscription 
      FROM reminders r
      JOIN users u ON r.user_id = u.id
      WHERE r.remind_at <= $1 
      AND r.notified = FALSE 
      AND u.push_subscription IS NOT NULL
    `, [now]);

    for (const reminder of dueReminders.rows) {
      const subscription = JSON.parse(reminder.push_subscription);
      const payload = JSON.stringify({
        title: 'Medicine Reminder: ' + reminder.medicine_name,
        body: `It's time for your dose: ${reminder.dosage}. Note: ${reminder.note}`,
        icon: '/favicon.ico'
      });

      try {
        await webPush.sendNotification(subscription, payload);
        // Mark as notified
        await pool.query('UPDATE reminders SET notified = TRUE WHERE id = $1', [reminder.id]);
        console.log(`Push notification sent for ${reminder.medicine_name}`);
      } catch (err) {
        console.error('Failed to send push notification:', err);
        // If subscription is no longer valid, we might want to clear it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pool.query('UPDATE users SET push_subscription = NULL WHERE id = $1', [reminder.user_id]);
        }
      }
    }
  } catch (err) {
    console.error('Background worker error:', err);
  }
}, 60000);

// Simple In-Memory Cache
const analysisCache = new Map();

// Sequential Queue implementation
class AsyncQueue {
  constructor() {
    this.queue = Promise.resolve();
  }
  add(operation) {
    return new Promise((resolve, reject) => {
      this.queue = this.queue.then(() => operation().then(resolve).catch(reject));
    });
  }
}
const requestQueue = new AsyncQueue();

// API Rate Limiting: 15 requests per 24 hours per IP
const apiLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 15, 
  message: { error: 'Daily limit reached. You can only perform 15 analyses per day.' }
});

// Exponential backoff retry wrapper for axios
async function callGeminiWithRetry(url, data, headers, retries = 3, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await axios.post(url, data, { headers });
    } catch (error) {
      if (error.response && error.response.status === 429 && attempt < retries) {
        console.warn(`Google API 429 rate limit hit. Retrying in ${delay}ms (Attempt ${attempt}/${retries})...`);
        await new Promise(res => setTimeout(res, delay));
        delay *= 2; // exponential backoff
      } else {
        throw error;
      }
    }
  }
}

app.use('/api/', apiLimiter);

// Configure multer for file uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['text/plain', 'application/pdf', 'image/jpeg', 'image/png'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only TXT, PDF, JPG, PNG allowed.'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// System prompt for Claude
const SYSTEM_PROMPT = `You are Aarogya, a compassionate AI medical assistant for Indian patients. Your goal is to explain medical reports AND decipher handwritten prescriptions clearly for people with NO medical background.

If the input is a MEDICAL REPORT:
- Explain lab values and findings in simple language.
- Use "metrics" for blood test values (e.g., Haemoglobin, Sugar).

If the input is a PRESCRIPTION:
- Decipher handwritten medicine names, dosages, and instructions.
- Use "metrics" to list medicines. "name" = Medicine name, "value" = Dosage (e.g. 500mg), "note" = Frequency/Timing (e.g. Twice a day after meals).
- In "findings", explain what each medicine is generally used for in plain language.

Respond ONLY with valid JSON — no markdown, no preamble, no code fences. Exact format:

{
  "title": "Short descriptive title (e.g., 'Blood Test Analysis' or 'Prescription Deciphered')",
  "overall_summary": "2-3 plain-language sentences summarizing the report or prescription",
  "overall_status": "Normal | Needs Attention | Requires Follow-up",
  "metrics": [
    { "name": "Item name", "value": "Value/Dosage", "status": "normal|high|low|review", "note": "Plain-language note/instruction" }
  ],
  "findings": [
    { "type": "normal|warning|alert|info", "title": "Key Point", "explanation": "Clear plain-language explanation" }
  ],
  "action_items": ["Actionable step 1", "Actionable step 2", "Actionable step 3"]
}

Rules:
- Simple language a standard school student can understand.
- Never use unexplained medical jargon.
- Be reassuring but honest.
- For prescriptions, focus on accuracy of medicine names and timings.
- 2-5 findings, 2-8 metrics, 2-5 action items.
- Always return valid JSON only.`;

/**
 * POST /api/analyze
 * Analyzes medical report text
 */
app.post('/api/analyze', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid input. Please provide report text.'
      });
    }

    if (!API_KEY) {
      return res.status(500).json({
        error: 'API key not configured. Please set GEMINI_API_KEY in .env file'
      });
    }

    // Caching check
    if (analysisCache.has(text)) {
      console.log('Returning cached analysis result.');
      return res.json({ success: true, data: analysisCache.get(text) });
    }

    // Call Gemini API via sequential queue and retry wrapper
    const response = await requestQueue.add(() => 
      callGeminiWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`, {
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [{
          parts: [{ text: `Analyze this medical report and explain it:\n\n${text}` }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      }, {
        'Content-Type': 'application/json'
      })
    );

    // Extract and parse the response
    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanedContent = content.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanedContent);

    analysisCache.set(text, result);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Analysis error:', error.message);

    // Handle specific error types (Gemini API issues)
    if (error.response?.status === 401 || error.response?.status === 400) {
      console.error('❌ Gemini API Auth Error: Please check your GEMINI_API_KEY in .env or Vercel settings');
      return res.status(500).json({
        error: 'Medical Analysis Engine Error: Invalid API configuration on server.'
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again later.'
      });
    }

    if (error instanceof SyntaxError) {
      return res.status(400).json({
        error: 'Failed to parse response. Please try again.'
      });
    }

    res.status(500).json({
      error: error.message || 'An error occurred during analysis'
    });
  }
});

/**
 * POST /api/analyze-file
 * Analyzes uploaded medical report files
 */
app.post('/api/analyze-file', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let text = '';
    let imageParts = [];

    // Extract text based on file type
    if (file.mimetype === 'text/plain') {
      text = file.buffer.toString('utf-8');
    } else if (file.mimetype === 'application/pdf') {
      const pdfData = await pdfParse(file.buffer);
      text = pdfData.text;
    } else if (file.mimetype.startsWith('image/')) {
      const base64Image = file.buffer.toString('base64');
      imageParts.push({
        inlineData: {
          mimeType: file.mimetype,
          data: base64Image
        }
      });
    }

    if (!text.trim() && imageParts.length === 0) {
      return res.status(400).json({ error: 'No valid content found in file' });
    }

    // Generate cache key
    const cacheKey = JSON.stringify({ 
      text: text.trim(), 
      imgSig: imageParts.map(p => p.inlineData.data.substring(0, 100)) 
    });

    if (analysisCache.has(cacheKey)) {
      console.log('Returning cached file analysis result.');
      return res.json({ success: true, data: analysisCache.get(cacheKey) });
    }

    // Call Gemini API via sequential queue and retry wrapper
    const response = await requestQueue.add(() => 
      callGeminiWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`, {
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [{
          parts: [
            { text: `Analyze this medical report and explain it:\n\n${text}` },
            ...imageParts
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      }, {
        'Content-Type': 'application/json'
      })
    );

    // Extract and parse the response
    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanedContent = content.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanedContent);

    analysisCache.set(cacheKey, result);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('File analysis error:', error.message);

    res.status(500).json({
      error: error.message || 'An error occurred during file analysis'
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiConfigured: !!API_KEY
  });
});

/**
 * GET /
 * Serve the HTML file
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Middleware error:', err);
  
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `File upload error: ${err.message}` });
  }
  
  res.status(500).json({
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🏥 Aarogya Medical Report Analyzer`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api/analyze`);
  console.log(`🔑 API Key: ${API_KEY ? '✓ Configured' : '✗ Missing'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});
module.exports = app;