#!/bin/bash
# Quick Setup Script for Aarogya Backend

echo "🏥 Aarogya Backend Setup Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo "✅ npm found: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "📝 Created .env file. Please edit it and add your ANTHROPIC_API_KEY"
    echo ""
fi

# Display next steps
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit .env file and add your Anthropic API key:"
echo "   ANTHROPIC_API_KEY=your_key_here"
echo ""
echo "2. Start the server:"
echo "   npm start          (production)"
echo "   npm run dev        (development with auto-reload)"
echo ""
echo "3. Open in browser:"
echo "   http://localhost:5000"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
