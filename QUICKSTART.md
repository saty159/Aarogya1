# 🚀 Quick Start Guide - Aarogya Backend

Get your medical report analyzer backend running in 5 minutes!

## Prerequisites

Before you start, make sure you have:
- ✅ Node.js installed (v14 or higher) - [Download](https://nodejs.org/)
- ✅ An Anthropic API key - [Get one here](https://console.anthropic.com/)

## Step-by-Step Setup

### Step 1: Navigate to Project Directory

```bash
cd c:\Users\Nikhil\Desktop\node.js\ai
```

### Step 2: Run Setup Script

**On Windows** (Recommended):
```bash
setup.bat
```

**On Mac/Linux**:
```bash
bash setup.sh
```

**Or Manually**:
```bash
npm install
```

### Step 3: Configure API Key

1. Open the `.env` file created in your project root
2. Replace `your_anthropic_api_key_here` with your actual Anthropic API key:

```env
ANTHROPIC_API_KEY=sk-ant-...your-key-here...
PORT=5000
NODE_ENV=development
```

**Where to get your API key:**
1. Go to https://console.anthropic.com/
2. Sign in or create account
3. Navigate to API Keys
4. Create new key and copy it
5. Paste in `.env` file

### Step 4: Start the Server

**Development Mode** (with auto-reload on file changes):
```bash
npm run dev
```

**Production Mode**:
```bash
npm start
```

You should see:
```
🏥 Aarogya Medical Report Analyzer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Server running on http://localhost:5000
📡 API: http://localhost:5000/api/analyze
🔑 API Key: ✓ Configured
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 5: Open in Browser

Visit: **http://localhost:5000**

✨ **You're all set!** The application is now running.

## Testing the API

### Test 1: Check Backend Health

```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-04-28T10:30:45.123Z",
  "apiConfigured": true
}
```

### Test 2: Analyze Sample Medical Report

```bash
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Haemoglobin: 11.2 g/dL\nWBC: 12,500 /μL\nBlood Glucose (Fasting): 145 mg/dL\nCholesterol: 220 mg/dL"
  }'
```

### Test 3: Upload a File

Create a file named `report.txt` with medical data, then:

```bash
curl -X POST http://localhost:5000/api/analyze-file \
  -F "file=@report.txt"
```

## Common Issues & Solutions

### ❌ "Backend server is not running"

**Solution**: Make sure the server is started
```bash
npm run dev
```

### ❌ "Invalid API key"

**Solution**: Check your `.env` file
- Verify API key is correct
- Ensure `.env` is in project root
- Restart server after updating `.env`

### ❌ "Port 5000 already in use"

**Solution**: Use a different port
```bash
PORT=3001 npm start
```

### ❌ "npm command not found"

**Solution**: Install Node.js from https://nodejs.org/

### ❌ "Module not found errors"

**Solution**: Reinstall dependencies
```bash
npm install
```

## Next Steps

### 🎨 Customize Frontend

Edit `index.html` to:
- Change colors and theme
- Add more features
- Modify UI layout

### 🔧 Advanced Features

Check `README.md` for:
- Database integration
- Caching setup
- Rate limiting
- Docker deployment

### 📦 Deploy to Cloud

Options:
- **Heroku**: Simple free tier available
- **Railway**: Modern deployment platform
- **Render**: Automated deployments
- **AWS/GCP/Azure**: Enterprise options

### 🛡️ Production Setup

Before deploying:
1. Enable HTTPS
2. Set up rate limiting
3. Add request validation
4. Configure error logging
5. Set up monitoring

## File Structure

```
ai/
├── server.js           ← Main backend file
├── index.html          ← Frontend (open in browser)
├── package.json        ← Dependencies
├── .env                ← Your API key (create this!)
├── config.js           ← Advanced configuration
├── Dockerfile          ← Docker container setup
├── docker-compose.yml  ← Docker compose setup
└── README.md           ← Full documentation
```

## Useful Commands

```bash
# Start server in development mode
npm run dev

# Start server in production mode
npm start

# Install dependencies
npm install

# View help
npm help

# Check Node version
node --version

# Check npm version
npm --version
```

## API Endpoints Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Open frontend |
| `/api/health` | GET | Check if server is running |
| `/api/analyze` | POST | Analyze medical report text |
| `/api/analyze-file` | POST | Upload and analyze file |

## Performance Tips

- ✅ Keep reports under 5000 characters for faster response
- ✅ Use text analysis over file upload when possible
- ✅ Close unused browser tabs to free resources
- ✅ Monitor API usage at https://console.anthropic.com/

## Support Resources

- 📖 [Full Documentation](README.md)
- 🐛 [GitHub Issues](https://github.com/your-repo/issues)
- 💬 [Discord Community](your-discord-link)
- 📧 Email: support@aarogya.local

## Security Reminders

⚠️ **Important**:
- Never share your `.env` file
- Never commit `.env` to version control
- Keep API key secret
- Use HTTPS in production
- Only analyze real medical data in testing

## What's Working?

✅ Backend API server  
✅ Medical report analysis  
✅ File upload support  
✅ Error handling  
✅ CORS enabled  
✅ Frontend integration  
✅ Health checks  

---

**Happy analyzing! 🏥**

For detailed documentation, see [README.md](README.md)
