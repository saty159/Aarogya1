/**
 * Aarogya API Documentation
 * 
 * Complete API reference for the Aarogya medical report analyzer backend.
 * Base URL: http://localhost:5000
 */

// ============================================================================
// 1. HEALTH CHECK ENDPOINT
// ============================================================================

/**
 * GET /api/health
 * 
 * Check if the backend server is running and API is configured
 * 
 * Response: 200 OK
 * {
 *   "status": "ok",
 *   "timestamp": "2025-04-28T10:30:45.123Z",
 *   "apiConfigured": true
 * }
 * 
 * Example:
 * curl http://localhost:5000/api/health
 */


// ============================================================================
// 2. ANALYZE TEXT ENDPOINT
// ============================================================================

/**
 * POST /api/analyze
 * 
 * Send medical report text for analysis
 * 
 * Request Headers:
 * {
 *   "Content-Type": "application/json"
 * }
 * 
 * Request Body:
 * {
 *   "text": "Medical report content here..."
 * }
 * 
 * Response: 200 OK
 * {
 *   "success": true,
 *   "data": {
 *     "title": "Blood Test Report",
 *     "overall_summary": "Your blood test shows...",
 *     "overall_status": "Needs Attention",
 *     "metrics": [
 *       {
 *         "name": "Haemoglobin",
 *         "value": "11.2 g/dL",
 *         "status": "low",
 *         "note": "Slightly below normal range"
 *       }
 *     ],
 *     "findings": [
 *       {
 *         "type": "warning",
 *         "title": "Low Hemoglobin",
 *         "explanation": "Your hemoglobin is below..."
 *       }
 *     ],
 *     "action_items": [
 *       "Consult your doctor about the low hemoglobin",
 *       "Increase iron-rich foods in your diet"
 *     ]
 *   }
 * }
 * 
 * Error Responses:
 * 
 * 400 Bad Request
 * {
 *   "error": "Invalid input. Please provide report text."
 * }
 * 
 * 401 Unauthorized
 * {
 *   "error": "Invalid API key. Check your ANTHROPIC_API_KEY in .env file"
 * }
 * 
 * 429 Too Many Requests
 * {
 *   "error": "Rate limit exceeded. Please try again later."
 * }
 * 
 * 500 Server Error
 * {
 *   "error": "An error occurred during analysis"
 * }
 * 
 * Examples:
 * 
 * // Using cURL
 * curl -X POST http://localhost:5000/api/analyze \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "text": "Haemoglobin: 11.2 g/dL\nWBC: 12,500 /μL"
 *   }'
 * 
 * // Using JavaScript/Fetch
 * const response = await fetch('http://localhost:5000/api/analyze', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json'
 *   },
 *   body: JSON.stringify({
 *     text: 'Haemoglobin: 11.2 g/dL\nWBC: 12,500 /μL'
 *   })
 * });
 * const data = await response.json();
 * console.log(data);
 * 
 * // Using Python/Requests
 * import requests
 * response = requests.post(
 *   'http://localhost:5000/api/analyze',
 *   json={'text': 'Haemoglobin: 11.2 g/dL\nWBC: 12,500 /μL'}
 * )
 * print(response.json())
 * 
 * // Using JavaScript/Axios
 * const axios = require('axios');
 * const response = await axios.post(
 *   'http://localhost:5000/api/analyze',
 *   { text: 'Haemoglobin: 11.2 g/dL\nWBC: 12,500 /μL' }
 * );
 * console.log(response.data);
 */


// ============================================================================
// 3. ANALYZE FILE ENDPOINT
// ============================================================================

/**
 * POST /api/analyze-file
 * 
 * Upload a medical report file for analysis
 * 
 * Supported file types:
 * - TXT (text/plain)
 * - PDF (application/pdf)
 * - JPG/JPEG (image/jpeg)
 * - PNG (image/png)
 * 
 * Max file size: 5MB
 * 
 * Request Headers:
 * {
 *   "Content-Type": "multipart/form-data"
 * }
 * 
 * Form Data:
 * - file: File object (binary)
 * 
 * Response: 200 OK
 * {
 *   "success": true,
 *   "data": {
 *     "title": "Blood Test Report",
 *     "overall_summary": "Your blood test shows...",
 *     "overall_status": "Needs Attention",
 *     "metrics": [...],
 *     "findings": [...],
 *     "action_items": [...]
 *   }
 * }
 * 
 * Error Responses:
 * 
 * 400 Bad Request
 * {
 *   "error": "No file uploaded"
 * }
 * or
 * {
 *   "error": "Invalid file type. Only TXT, PDF, JPG, PNG allowed."
 * }
 * or
 * {
 *   "error": "File upload error: File too large"
 * }
 * 
 * 500 Server Error
 * {
 *   "error": "An error occurred during file analysis"
 * }
 * 
 * Examples:
 * 
 * // Using cURL
 * curl -X POST http://localhost:5000/api/analyze-file \
 *   -F "file=@report.txt"
 * 
 * curl -X POST http://localhost:5000/api/analyze-file \
 *   -F "file=@report.pdf"
 * 
 * // Using JavaScript/FormData
 * const formData = new FormData();
 * formData.append('file', fileInput.files[0]);
 * 
 * const response = await fetch('http://localhost:5000/api/analyze-file', {
 *   method: 'POST',
 *   body: formData
 * });
 * const data = await response.json();
 * console.log(data);
 * 
 * // Using Python/Requests
 * import requests
 * with open('report.txt', 'rb') as f:
 *   files = {'file': f}
 *   response = requests.post(
 *     'http://localhost:5000/api/analyze-file',
 *     files=files
 *   )
 * print(response.json())
 * 
 * // Using cURL with larger files
 * curl -X POST http://localhost:5000/api/analyze-file \
 *   -F "file=@large_report.pdf" \
 *   -H "Transfer-Encoding: chunked"
 */


// ============================================================================
// RESPONSE DATA STRUCTURE
// ============================================================================

/**
 * Analysis Result Format
 * 
 * {
 *   "title": string,                    // Short descriptive title of report type
 *   "overall_summary": string,          // 2-3 sentence summary in plain language
 *   "overall_status": string,           // "Normal" | "Needs Attention" | "Requires Follow-up"
 *   "metrics": [
 *     {
 *       "name": string,                 // Test name (e.g., "Haemoglobin")
 *       "value": string,                // Value with units (e.g., "11.2 g/dL")
 *       "status": string,               // "normal" | "high" | "low" | "review"
 *       "note": string                  // Plain language explanation
 *     }
 *   ],
 *   "findings": [
 *     {
 *       "type": string,                 // "normal" | "warning" | "alert" | "info"
 *       "title": string,                // Finding title
 *       "explanation": string           // Detailed plain language explanation
 *     }
 *   ],
 *   "action_items": [string]            // List of actionable next steps
 * }
 */


// ============================================================================
// HTTP STATUS CODES
// ============================================================================

/**
 * Status Codes Used:
 * 
 * 200 OK
 *   - Request successful, analysis completed
 * 
 * 400 Bad Request
 *   - Missing or invalid input data
 *   - Invalid file type or size
 *   - Malformed JSON
 * 
 * 401 Unauthorized
 *   - Invalid or missing API key
 *   - API key configuration error
 * 
 * 429 Too Many Requests
 *   - Rate limit exceeded
 *   - Too many requests in short time
 * 
 * 500 Internal Server Error
 *   - Server error during processing
 *   - API connection error
 *   - File parsing error
 */


// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Rate Limiting (when enabled):
 * - 100 requests per 15 minutes per IP address
 * - Returns 429 when exceeded
 * 
 * Headers in response:
 * - X-RateLimit-Limit: Maximum requests allowed
 * - X-RateLimit-Remaining: Requests remaining in window
 * - X-RateLimit-Reset: Unix timestamp when limit resets
 * 
 * Example:
 * X-RateLimit-Limit: 100
 * X-RateLimit-Remaining: 45
 * X-RateLimit-Reset: 1693478400
 */


// ============================================================================
// REQUEST/RESPONSE EXAMPLES
// ============================================================================

/**
 * EXAMPLE 1: Simple Text Analysis
 * 
 * Request:
 * POST /api/analyze
 * Content-Type: application/json
 * 
 * {
 *   "text": "Haemoglobin: 11.2 g/dL\nWBC: 12,500 /μL\nPlatelets: 250,000 /μL"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "title": "Complete Blood Count",
 *     "overall_summary": "Your blood count shows low hemoglobin which means your blood may not carry enough oxygen.",
 *     "overall_status": "Needs Attention",
 *     "metrics": [
 *       {
 *         "name": "Haemoglobin",
 *         "value": "11.2 g/dL",
 *         "status": "low",
 *         "note": "Below the normal range of 12-16 g/dL for women"
 *       },
 *       {
 *         "name": "WBC",
 *         "value": "12,500 /μL",
 *         "status": "high",
 *         "note": "Slightly elevated, may indicate minor infection"
 *       },
 *       {
 *         "name": "Platelets",
 *         "value": "250,000 /μL",
 *         "status": "normal",
 *         "note": "Normal clotting function"
 *       }
 *     ],
 *     "findings": [
 *       {
 *         "type": "alert",
 *         "title": "Low Hemoglobin (Anemia)",
 *         "explanation": "Your hemoglobin is lower than normal. This means your blood cannot carry as much oxygen as it should."
 *       },
 *       {
 *         "type": "warning",
 *         "title": "Elevated WBC Count",
 *         "explanation": "Your white blood cell count is slightly higher than normal, which might indicate a minor infection or inflammation."
 *       }
 *     ],
 *     "action_items": [
 *       "Consult your doctor about the low hemoglobin",
 *       "Eat more iron-rich foods like spinach, lentils, and red meat",
 *       "Get retested in 2-3 weeks to track the hemoglobin level",
 *       "Discuss with doctor if symptoms like fatigue or shortness of breath persist"
 *     ]
 *   }
 * }
 */


/**
 * EXAMPLE 2: File Upload
 * 
 * Request:
 * POST /api/analyze-file
 * Content-Type: multipart/form-data
 * 
 * [file: report.pdf binary data]
 * 
 * Response: Same structure as text analysis
 */


/**
 * EXAMPLE 3: Health Check
 * 
 * Request:
 * GET /api/health
 * 
 * Response:
 * {
 *   "status": "ok",
 *   "timestamp": "2025-04-28T10:30:45.123Z",
 *   "apiConfigured": true
 * }
 */


// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Authentication:
 * - API Key stored securely in backend .env file
 * - No API key needed in frontend requests
 * - Backend handles all authentication
 * 
 * Security:
 * - Never expose API key in frontend code
 * - All requests go through secure backend proxy
 * - CORS enabled only for allowed origins
 * - Input validation on all endpoints
 */


// ============================================================================
// PERFORMANCE CONSIDERATIONS
// ============================================================================

/**
 * Performance Tips:
 * 
 * 1. Request Size
 *    - Keep medical report text under 5000 characters
 *    - Larger requests take longer to process
 * 
 * 2. Timeout
 *    - Default timeout: 30 seconds
 *    - Adjust if needed in config.js
 * 
 * 3. Caching
 *    - Consider caching results for same inputs
 *    - Useful for frequently analyzed reports
 * 
 * 4. Batch Processing
 *    - Don't send requests too rapidly
 *    - Wait for response before sending next request
 * 
 * 5. File Size
 *    - Max 5MB per file
 *    - Text files process faster than PDFs
 */


// ============================================================================
// WEBSOCKETS (Future Enhancement)
// ============================================================================

/**
 * WebSocket endpoints (when implemented):
 * 
 * Connection:
 * ws://localhost:5000/api/analyze-stream
 * 
 * Send:
 * {
 *   "action": "analyze",
 *   "text": "medical report..."
 * }
 * 
 * Receive (streaming):
 * {
 *   "status": "processing",
 *   "progress": 0.25
 * }
 * ...
 * {
 *   "status": "complete",
 *   "data": {...}
 * }
 */


// ============================================================================
// TESTING COMMANDS
// ============================================================================

/**
 * Test Health Check
 * curl http://localhost:5000/api/health
 * 
 * Test Text Analysis
 * curl -X POST http://localhost:5000/api/analyze \
 *   -H "Content-Type: application/json" \
 *   -d '{"text":"Haemoglobin: 11.2 g/dL"}'
 * 
 * Test File Upload
 * curl -X POST http://localhost:5000/api/analyze-file \
 *   -F "file=@report.txt"
 * 
 * Test with timeout
 * timeout 5 curl http://localhost:5000/api/analyze-file
 * 
 * Test with verbose output
 * curl -v http://localhost:5000/api/health
 */


// ============================================================================
// ERROR HANDLING GUIDE
// ============================================================================

/**
 * Common Errors and Solutions:
 * 
 * Error: "Backend server is not running"
 * Solution: Start the server with: npm start
 * 
 * Error: "Invalid API key"
 * Solution: Check .env file and restart server
 * 
 * Error: "Request timeout"
 * Solution: Try again or check server logs
 * 
 * Error: "File too large"
 * Solution: File must be under 5MB
 * 
 * Error: "Invalid file type"
 * Solution: Only TXT, PDF, JPG, PNG allowed
 * 
 * Error: "Rate limit exceeded"
 * Solution: Wait before sending more requests
 */
