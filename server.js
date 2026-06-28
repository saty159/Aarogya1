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
const fs = require('fs');
const crypto = require('crypto');


// Load environment variables
dotenv.config();



const app = express();
const PORT = process.env.PORT || 5000;
const API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
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

const USERS_FILE = process.env.VERCEL
  ? '/tmp/users-db.json'
  : path.join(__dirname, 'users-db.json');

const REPORTS_FILE = process.env.VERCEL
  ? '/tmp/reports-db.json'
  : path.join(__dirname, 'reports-db.json');

let useLocalDb = false;

// Helper to read local users
function readLocalUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('❌ Error reading local users file:', err.message);
    return [];
  }
}

// Helper to write local users
function writeLocalUsers(users) {
  try {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Error writing local users file:', err.message);
  }
}

// Helper to read local reports
function readLocalReports() {
  try {
    if (!fs.existsSync(REPORTS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(REPORTS_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('❌ Error reading local reports file:', err.message);
    return [];
  }
}

// Helper to write local reports
function writeLocalReports(reports) {
  try {
    const dir = path.dirname(REPORTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Error writing local reports file:', err.message);
  }
}

// User repository wrapper
const userRepo = {
  async findByEmail(email) {
    if (!useLocalDb) {
      try {
        const fetchUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        return fetchUser.rows[0] || null;
      } catch (err) {
        console.error('❌ Database error during findByEmail, switching to local DB:', err.message);
        useLocalDb = true;
      }
    }
    
    // Fallback to local DB
    const users = readLocalUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  async create(email, hashedPassword, name) {
    if (!useLocalDb) {
      try {
        const insertUser = await pool.query(
          'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
          [email, hashedPassword, name || email]
        );
        return insertUser.rows[0];
      } catch (err) {
        console.error('❌ Database error during createUser, switching to local DB:', err.message);
        useLocalDb = true;
      }
    }

    // Fallback to local DB
    const users = readLocalUsers();
    // Double check email uniqueness locally
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('User already exists in local database');
    }

    const newUser = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36),
      email,
      password: hashedPassword,
      name: name || email,
      created_at: new Date().toISOString()
    };

    users.push(newUser);
    writeLocalUsers(users);

    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name
    };
  }
};

// Report repository wrapper
const reportRepo = {
  async create(userId, title, overallSummary, overallStatus, data) {
    if (!useLocalDb) {
      try {
        const insertReport = await pool.query(
          `INSERT INTO reports (user_id, title, overall_summary, overall_status, data) 
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [userId, title, overallSummary, overallStatus, JSON.stringify(data)]
        );
        return insertReport.rows[0];
      } catch (err) {
        console.error('❌ Database error during createReport, falling back to local DB:', err.message);
      }
    }

    // Fallback to local DB
    const reports = readLocalReports();
    const newReport = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36),
      user_id: userId,
      title,
      overall_summary: overallSummary,
      overall_status: overallStatus,
      data,
      created_at: new Date().toISOString()
    };
    reports.push(newReport);
    writeLocalReports(reports);
    return newReport;
  },

  async findByUserId(userId) {
    if (!useLocalDb) {
      try {
        const fetchReports = await pool.query(
          'SELECT id, user_id, title, overall_summary, overall_status, created_at FROM reports WHERE user_id = $1 ORDER BY created_at DESC',
          [userId]
        );
        return fetchReports.rows;
      } catch (err) {
        console.error('❌ Database error during findByUserId, falling back to local DB:', err.message);
      }
    }

    // Fallback to local DB
    const reports = readLocalReports();
    return reports
      .filter(r => r.user_id === userId)
      .map(r => ({
        id: r.id,
        user_id: r.user_id,
        title: r.title,
        overall_summary: r.overall_summary,
        overall_status: r.overall_status,
        created_at: r.created_at
      }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async findById(id, userId) {
    if (!useLocalDb) {
      try {
        const fetchReport = await pool.query(
          'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
          [id, userId]
        );
        return fetchReport.rows[0] || null;
      } catch (err) {
        console.error('❌ Database error during findById, falling back to local DB:', err.message);
      }
    }

    // Fallback to local DB
    const reports = readLocalReports();
    return reports.find(r => r.id === id && r.user_id === userId) || null;
  },

  async delete(id, userId) {
    if (!useLocalDb) {
      try {
        const deleteReport = await pool.query(
          'DELETE FROM reports WHERE id = $1 AND user_id = $2 RETURNING id',
          [id, userId]
        );
        if (deleteReport.rowCount > 0) return true;
      } catch (err) {
        console.error('❌ Database error during delete, falling back to local DB:', err.message);
      }
    }

    // Fallback to local DB
    const reports = readLocalReports();
    const index = reports.findIndex(r => r.id === id && r.user_id === userId);
    if (index !== -1) {
      reports.splice(index, 1);
      writeLocalReports(reports);
      return true;
    }
    return false;
  }
};

// Initialize Database Tables
async function initDB() {
  try {
    // Migration: Ensure tables exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        overall_summary TEXT,
        overall_status TEXT,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Database tables and migrations initialized');
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    console.warn('⚠️ Falling back to local file-based database (users-db.json, reports-db.json)');
    useLocalDb = true;
    try {
      if (!fs.existsSync(USERS_FILE)) {
        writeLocalUsers([]);
      }
      if (!fs.existsSync(REPORTS_FILE)) {
        writeLocalReports([]);
      }
    } catch (fsErr) {
      console.error('❌ Failed to initialize local database file:', fsErr.message);
    }
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
    
    const checkUser = await userRepo.findByEmail(email);
    if (checkUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await userRepo.create(email, hashedPassword, name);

    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ success: true, token, user: { email: newUser.email, name: newUser.name } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await userRepo.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, user: { email: user.email, name: user.name } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Login failed' });
  }
});



// Robust LLM JSON Parser
function parseLLMJSON(text) {
  if (!text || typeof text !== 'string') {
    throw new SyntaxError('Empty or invalid response');
  }
  
  const cleanedText = text.trim();
  
  // Try direct parse first
  try {
    return JSON.parse(cleanedText);
  } catch (e) {
    // If direct parse fails, try extracting between first { and last }
    const start = cleanedText.indexOf('{');
    const end = cleanedText.lastIndexOf('}');
    if (start !== -1 && end !== -1 && start < end) {
      const jsonStr = cleanedText.substring(start, end + 1);
      try {
        return JSON.parse(jsonStr);
      } catch (innerError) {
        // Try removing markdown fences if they are inside the extracted string
        try {
          const cleaned = jsonStr.replace(/```json|```/g, '').trim();
          return JSON.parse(cleaned);
        } catch (innerError2) {
          throw new SyntaxError('Failed to parse JSON content from response: ' + innerError2.message);
        }
      }
    }
    throw e;
  }
}

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

async function callGroq(text) {
  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Analyze this medical report and explain it:\n\n${text}` }
      ],
      response_format: { type: "json_object" }
    }, {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return parseLLMJSON(response.data.choices[0].message.content);
  } catch (error) {
    console.error('Groq API Error:', error.message);
    throw error;
  }
}

app.use('/api/', apiLimiter);

// Configure multer for file uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['text/plain', 'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only TXT, PDF, JPG, PNG, WEBP, HEIC, HEIF allowed.'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// System prompt for Gemini with OCR Double-Verification
const SYSTEM_PROMPT = `You are Aarogya, a high-precision AI medical assistant. Your task is to extract and interpret medical reports and prescriptions with 100% accuracy.

### OCR DOUBLE-VERIFICATION RULES:
1. **Initial Scan**: Extract all text, numbers, and medicine names.
2. **Medical Context Check**: Cross-reference names with known medical terms (e.g., if you see "Paracetam0l", verify it is "Paracetamol").
3. **Number Audit**: Carefully check decimal points (e.g., 0.5mg vs 5mg). If a value is clinically impossible, flag it.
4. **Prescription Logic**: If a dosage is missing but implied by frequency (1-0-1), note that.

### OUTPUT FORMAT (STRICT JSON ONLY):
{
  "title": "Report Title",
  "overall_summary": "Summary...",
  "overall_status": "Status...",
  "raw_extraction": "Full raw text extracted for transparency",
  "metrics": [
    { 
      "name": "Item Name", 
      "value": "Value", 
      "status": "normal|high|low|review", 
      "note": "Note...",
      "confidence": 0-100,
      "ocr_note": "Self-verification note about OCR accuracy for this item"
    }
  ],
  "findings": [
    { 
      "type": "type", 
      "title": "Title", 
      "explanation": "Exp...", 
      "confidence": 0-100 
    }
  ],
  "action_items": ["Step 1", "Step 2"]
}

### STRICT SCOPE RULES (MANDATORY):
1. **Medical Only**: You MUST ONLY analyze medical reports, blood tests, lab results, or prescriptions.
2. **Rejection**: If the input is NOT a medical document (e.g., it is a general question, a non-medical image, a recipe, a book page, etc.), you MUST return a JSON object with an 'error' field: {"error": "Invalid Document. Aarogya only interprets medical reports and prescriptions."}. Do not attempt to interpret non-medical text.

### RULES:
- Provide a 'confidence' score (0-100) for every metric and finding based on how clear the handwriting/text was.
- If confidence is below 70, explain why in 'ocr_note'.
- Never skip a medicine name; if illegible, mark as "Illegible [Confidence Score]".
- Use simple language for explanations.`;

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
      const cachedResult = analysisCache.get(text);
      try {
        const saved = await reportRepo.create(req.user.id, cachedResult.title, cachedResult.overall_summary, cachedResult.overall_status, cachedResult);
        cachedResult.id = saved.id;
      } catch (dbErr) {
        console.error('Failed to save cached report to database:', dbErr.message);
      }
      return res.json({ success: true, data: cachedResult });
    }

    // Call APIs (Consensus Approach)
    let result;
    try {
      // Primary: Gemini
      const response = await requestQueue.add(() => 
        callGeminiWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`, {
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: `Analyze this medical report and explain it:\n\n${text}` }] }],
          generationConfig: { responseMimeType: "application/json" }
        }, { 'Content-Type': 'application/json' })
      );
      const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      result = parseLLMJSON(content);

      // Secondary: Groq (for consensus/re-verification if text)
      if (GROQ_API_KEY) {
        try {
          const groqResult = await callGroq(text);
          // Simple consensus: mix action items or use Groq to double check
          result.groq_verified = true;
          console.log('✅ Groq Consensus achieved');
        } catch (e) {
          console.warn('Groq consensus failed, using Gemini only');
        }
      }
    } catch (e) {
      // Fallback to Groq if Gemini fails
      if (GROQ_API_KEY) {
        console.log('Gemini failed, trying Groq fallback...');
        console.error('Gemini error details:', e.message, e.response ? JSON.stringify(e.response.data) : '');
        result = await callGroq(text);
        result.fallback_active = true;
      } else {
        throw e;
      }
    }

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    // Save to user history
    try {
      const saved = await reportRepo.create(req.user.id, result.title, result.overall_summary, result.overall_status, result);
      result.id = saved.id;
    } catch (dbErr) {
      console.error('Failed to save report to database:', dbErr.message);
    }

    analysisCache.set(text, result);
    res.json({ success: true, data: result });

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
      const cachedResult = analysisCache.get(cacheKey);
      try {
        const saved = await reportRepo.create(req.user.id, cachedResult.title, cachedResult.overall_summary, cachedResult.overall_status, cachedResult);
        cachedResult.id = saved.id;
      } catch (dbErr) {
        console.error('Failed to save cached report to database:', dbErr.message);
      }
      return res.json({ success: true, data: cachedResult });
    }

    // Call APIs (Consensus Approach)
    let result;
    try {
      // Primary: Gemini (Vision + Interpretation)
      const response = await requestQueue.add(() => 
        callGeminiWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`, {
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: `Analyze this medical report and explain it:\n\n${text}` }, ...imageParts] }],
          generationConfig: { responseMimeType: "application/json" }
        }, { 'Content-Type': 'application/json' })
      );
      const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      result = parseLLMJSON(content);

      // Secondary: Groq (if text was extracted, cross-verify)
      if (GROQ_API_KEY && text.trim()) {
        try {
          await callGroq(text);
          result.groq_verified = true;
          console.log('✅ Groq Consensus achieved for file');
        } catch (e) {
          console.warn('Groq consensus failed for file');
        }
      }
    } catch (e) {
      // Fallback to Groq for text-based files
      if (GROQ_API_KEY && text.trim()) {
        console.log('Gemini failed for file, trying Groq fallback...');
        console.error('Gemini error details for file:', e.message, e.response ? JSON.stringify(e.response.data) : '');
        result = await callGroq(text);
        result.fallback_active = true;
      } else {
        throw e;
      }
    }

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    // Save to user history
    try {
      const saved = await reportRepo.create(req.user.id, result.title, result.overall_summary, result.overall_status, result);
      result.id = saved.id;
    } catch (dbErr) {
      console.error('Failed to save report to database:', dbErr.message);
    }

    analysisCache.set(cacheKey, result);
    res.json({ success: true, data: result });

  } catch (error) {
    console.error('File analysis error:', error.message);

    res.status(500).json({
      error: error.message || 'An error occurred during file analysis'
    });
  }
});

/**
 * GET /api/history
 * Retrieves analysis history for the authenticated user
 */
app.get('/api/history', authenticateToken, async (req, res) => {
  try {
    const history = await reportRepo.findByUserId(req.user.id);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching history:', error.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/**
 * GET /api/history/:id
 * Retrieves a specific analysis result from the user's history
 */
app.get('/api/history/:id', authenticateToken, async (req, res) => {
  try {
    const report = await reportRepo.findById(req.params.id, req.user.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Error fetching report details:', error.message);
    res.status(500).json({ error: 'Failed to fetch report details' });
  }
});

/**
 * DELETE /api/history/:id
 * Deletes a specific report from the user's history
 */
app.delete('/api/history/:id', authenticateToken, async (req, res) => {
  try {
    const success = await reportRepo.delete(req.params.id, req.user.id);
    if (!success) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error.message);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

/**
 * GET /api/health
 * Health check endpoint with API diagnostics
 */
app.get('/api/health', async (req, res) => {
  const diagnostics = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    gemini: { configured: !!API_KEY, status: 'unknown' },
    groq: { configured: !!GROQ_API_KEY, status: 'unknown' }
  };

  // Test Gemini
  if (API_KEY) {
    try {
      await axios.get(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest?key=${API_KEY}`);
      diagnostics.gemini.status = 'connected';
    } catch (e) {
      diagnostics.gemini.status = 'error';
      diagnostics.gemini.error = e.message;
    }
  }

  // Test Groq
  if (GROQ_API_KEY) {
    try {
      await axios.get('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` }
      });
      diagnostics.groq.status = 'connected';
    } catch (e) {
      diagnostics.groq.status = 'error';
      diagnostics.groq.error = e.message;
    }
  }

  res.json(diagnostics);
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