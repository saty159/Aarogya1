const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const API_KEY = process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static('.'));

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
app.post('/api/analyze', async (req, res) => {
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

    // Call Gemini API
    const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
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
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Extract and parse the response
    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanedContent = content.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanedContent);

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
app.post('/api/analyze-file', upload.single('file'), async (req, res) => {
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

    // Call Gemini API
    const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
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
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Extract and parse the response
    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanedContent = content.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanedContent);

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