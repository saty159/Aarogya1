/**
 * Advanced Configuration for Aarogya Backend
 * 
 * This file contains optional configuration settings for production deployments,
 * logging, database connections, and advanced features.
 */

module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || 'development',
    hostname: process.env.HOST || 'localhost'
  },

  // API Configuration
  api: {
    timeout: 30000, // 30 seconds
    maxRetries: 3,
    retryDelay: 1000, // 1 second
    requestLimit: '10mb' // Max request size
  },

  // Anthropic API Configuration
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1800,
    apiVersion: '2023-06-01',
    baseUrl: 'https://api.anthropic.com'
  },

  // File Upload Configuration
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    uploadDir: './uploads',
    allowedMimeTypes: [
      'text/plain',
      'application/pdf',
      'image/jpeg',
      'image/png'
    ],
    allowedExtensions: ['.txt', '.pdf', '.jpg', '.jpeg', '.png']
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'combined', // 'combined', 'common', 'dev'
    requestLog: true,
    errorLog: true
  },

  // Rate Limiting (optional - for production)
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED === 'true',
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100 // requests per window
  },

  // Database Configuration (optional - for storing results)
  database: {
    enabled: process.env.DB_ENABLED === 'true',
    type: process.env.DB_TYPE || 'mongodb',
    url: process.env.DATABASE_URL,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },

  // Cache Configuration (optional - Redis)
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    type: process.env.CACHE_TYPE || 'redis',
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: 3600 // 1 hour
  },

  // Security Configuration
  security: {
    enableHttps: process.env.HTTPS_ENABLED === 'true',
    certPath: process.env.CERT_PATH,
    keyPath: process.env.KEY_PATH,
    enableCsrf: false, // CSRF protection for forms
    enableHelmet: true, // Security headers
    enableValidation: true // Input validation
  },

  // Notification Configuration (optional - for errors)
  notifications: {
    enabled: process.env.NOTIFICATIONS_ENABLED === 'true',
    type: process.env.NOTIFICATION_TYPE || 'email',
    email: process.env.NOTIFICATION_EMAIL,
    slack: process.env.SLACK_WEBHOOK_URL
  },

  // System Prompt Configuration
  systemPrompt: `You are Aarogya, a compassionate AI medical report interpreter for Indian patients. Explain medical reports clearly to people with NO medical background.

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
- Always return valid JSON only`,

  // Feature Flags
  features: {
    enableFileUpload: true,
    enableTextAnalysis: true,
    enableCache: false,
    enableDatabase: false,
    enableAnalytics: false,
    enableWebSocket: false,
    enableBatchProcessing: false
  },

  // Analytics Configuration (optional)
  analytics: {
    enabled: process.env.ANALYTICS_ENABLED === 'true',
    trackRequestDuration: true,
    trackErrors: true,
    trackApiUsage: true
  }
};
