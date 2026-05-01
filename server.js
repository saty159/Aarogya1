const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config();

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

// Middleware IP tracking removed for Vercel Serverless compatibility

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

    // Handle specific error types
    if (error.response?.status === 401 || error.response?.status === 400) {
      return res.status(401).json({
        error: 'Invalid API key. Check your API key in .env file'
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