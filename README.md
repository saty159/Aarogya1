# Aarogya - AI Medical Report Explainer Backend

A complete Node.js backend for the Aarogya medical report analyzer application. This backend securely handles API calls to Claude AI, file uploads, and report analysis.

## Features

- 🏥 **Medical Report Analysis**: Send medical report text and get plain-language explanations
- 📄 **File Upload Support**: Upload TXT and PDF files for analysis
- 🔐 **Secure API**: Backend handles all API calls securely (no exposed API keys in frontend)
- ⚡ **Fast Processing**: Async/await for non-blocking operations
- 🛡️ **Error Handling**: Comprehensive error handling and validation
- 📊 **Health Checks**: Endpoint to verify backend status
- 🔄 **CORS Enabled**: Cross-origin requests for frontend communication

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Anthropic API Key (Get it at: https://console.anthropic.com/)

## Installation

### 1. Clone or Navigate to Project

```bash
cd c:\Users\Nikhil\Desktop\node.js\ai
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Environment File

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

### 4. Add Your API Key

Edit `.env` and replace `your_anthropic_api_key_here` with your actual Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
PORT=5000
NODE_ENV=development
```

## Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:5000`

You should see:
```
🏥 Aarogya Medical Report Analyzer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Server running on http://localhost:5000
📡 API: http://localhost:5000/api/analyze
🔑 API Key: ✓ Configured
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## API Endpoints

### 1. Analyze Medical Report Text

**Endpoint**: `POST /api/analyze`

**Request**:
```json
{
  "text": "Haemoglobin: 11.2 g/dL\nWBC: 12,500 /μL\nBlood Glucose (Fasting): 145 mg/dL"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "title": "Blood Test Report",
    "overall_summary": "Your blood test shows some values that need attention...",
    "overall_status": "Needs Attention",
    "metrics": [
      {
        "name": "Haemoglobin",
        "value": "11.2 g/dL",
        "status": "low",
        "note": "This is slightly low..."
      }
    ],
    "findings": [...],
    "action_items": [...]
  }
}
```

### 2. Upload and Analyze File

**Endpoint**: `POST /api/analyze-file`

**Content-Type**: `multipart/form-data`

**Form Data**:
- `file`: Medical report file (TXT, PDF, JPG, PNG - max 5MB)

**Example using cURL**:
```bash
curl -X POST http://localhost:5000/api/analyze-file \
  -F "file=@path/to/report.pdf"
```

**Example using JavaScript**:
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://localhost:5000/api/analyze-file', {
  method: 'POST',
  body: formData
});

const data = await response.json();
console.log(data);
```

### 3. Health Check

**Endpoint**: `GET /api/health`

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-04-28T10:30:45.123Z",
  "apiConfigured": true
}
```

## Project Structure

```
ai/
├── server.js              # Main Express server
├── index.html             # Frontend HTML (updated to use backend API)
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables (create this)
├── .env.example           # Example environment file
├── .gitignore             # Git ignore file (create this)
├── uploads/               # Uploaded files directory (created automatically)
└── README.md              # This file
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Required |
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment (development/production) | development |
| `CORS_ORIGIN` | Allowed CORS origins | All origins |

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- **400**: Bad request (missing/invalid input)
- **401**: Unauthorized (invalid API key)
- **429**: Rate limit exceeded
- **500**: Server error

**Example Error Response**:
```json
{
  "error": "Invalid input. Please provide report text."
}
```

## Security Best Practices

1. **Never commit .env file** - Already in .gitignore
2. **Keep API key secret** - Only store in .env file
3. **Use HTTPS in production** - For secure data transmission
4. **Validate inputs** - All requests are validated
5. **Rate limiting** - Consider adding rate limiting in production
6. **File upload limits** - Max 5MB per file

## Troubleshooting

### Port Already in Use

If port 5000 is already in use:
```bash
# Use a different port
PORT=3001 npm start
```

### API Key Error

```
Error: Invalid API key. Check your ANTHROPIC_API_KEY in .env file
```

- Verify your key is correct at https://console.anthropic.com/
- Make sure .env file is in the project root
- Restart the server after updating .env

### Backend Not Running

If you get "Backend server is not running" error:
```bash
npm start
# or for development
npm run dev
```

### File Upload Issues

- Maximum file size: 5MB
- Supported formats: TXT, PDF, JPG, PNG
- For large files, split the content and analyze separately

## Testing the API

### Using cURL

```bash
# Test health check
curl http://localhost:5000/api/health

# Test text analysis
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"Haemoglobin: 11.2 g/dL\nWBC: 12,500"}'

# Test file upload
curl -X POST http://localhost:5000/api/analyze-file \
  -F "file=@report.txt"
```

### Using Postman

1. Import the API endpoints
2. Add your test data
3. Send requests to `http://localhost:5000/api/...`

## Frontend Integration

The HTML file (`index.html`) is already configured to:
- Connect to the backend API at `http://localhost:5000`
- Send analysis requests to `/api/analyze`
- Upload files to `/api/analyze-file`
- Check backend health before making requests

Just open `http://localhost:5000` in your browser after starting the server.

## Performance Tips

1. **Cache results**: Consider adding caching for repeated analyses
2. **Batch processing**: For multiple reports, process sequentially
3. **Compression**: Enable gzip compression for responses
4. **Database**: Store analysis results for audit/history

## Deployment

### Deploy to Heroku

```bash
# Create Procfile
echo "web: npm start" > Procfile

# Deploy
git push heroku main
```

### Deploy to Railway/Render

1. Connect your GitHub repo
2. Add `ANTHROPIC_API_KEY` environment variable
3. Deploy automatically on push

## Development

### Running Tests

```bash
npm test
```

### Code Formatting

```bash
npm run format
```

### Running with Nodemon (auto-restart)

```bash
npm run dev
```

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review error messages in console
3. Verify API key and configuration
4. Check network connectivity

## License

MIT

## Important Notes

⚠️ **Medical Disclaimer**: This tool is for educational purposes only. Always consult qualified healthcare professionals for medical advice.

⚠️ **API Costs**: The Anthropic API uses your account's credits. Monitor usage at https://console.anthropic.com/

⚠️ **Privacy**: Be cautious with sensitive medical information. Use HTTPS in production.

---

**Made with ❤️ for better health understanding**
#   A a r o g y a 2  
 