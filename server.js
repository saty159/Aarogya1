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

// File-based Database configuration
const DB_FILE = path.join(__dirname, 'users.json');

function getUsers() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify([]));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (e) {
    console.error('Database read error:', e);
    return [];
  }
}

function saveUsers(users) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
  } catch (e) {
    console.error('Database write error:', e);
  }
}

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
    
    const users = getUsers();
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now().toString(), email, password: hashedPassword, name: name || email };
    
    users.push(newUser);
    saveUsers(users);

    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ success: true, token, user: { email: newUser.email, name: newUser.name } });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = getUsers();
    const user = users.find(u => u.email === email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, user: { email: user.email, name: user.name } });
  } catch (error) {
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

// API Rate Limiting: 15 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 15, 
  message: { error: 'Too many requests from this IP, please try again after a minute.' }
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
const SYSTEM_PROMPT = `You are Aarogya, a compassionate AI medical report interpreter for Indian patients. Explain medical reports clearly to people with NO medical background.

Respond ONLY with valid JSON — no markdown, no preamble, no code fences. Exact format:

{
  "title": "Short report type title",
  "overall_summary": "2-3 plain-language sentences summarizing what the report shows overall",
  "overall_status": "Normal | Needs Attention | Requires Follow-up",
  "metrics": [
    { "name": "Test name", "value": "Value with units", "status": "normal|high|low|review", "note": "Plain-language note" }
  ],
  "findings": [
    { "type": "normal|warning|alert|info", "title": "Finding title", "explanation": "Clear plain-language explanation" }
  ],
  "action_items": ["Actionable step 1", "Actionable step 2", "Actionable step 3"]
}

Rules:
- Simple language a standard school student can understand
- Never use unexplained medical jargon
- Be reassuring but honest
- 2-5 findings, 2-5 metrics (only if numeric values present), 2-5 action items
- Always return valid JSON only`;

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
console.log("API KEY:", API_KEY);

module.exports = app;