#!/bin/bash
# Setup script for Lumen - Song Operator

echo "🎵 Lumen - Song Operator Setup"
echo "=============================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ .env.local not found"
    echo ""
    echo "Please create .env.local with your Supabase credentials:"
    echo ""
    echo "NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co"
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key"
    echo ""
    echo "Find these values in your Supabase project settings → API"
    exit 1
fi

echo "✅ .env.local found"
echo ""

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ node_modules found"
fi

echo ""
echo "🚀 Starting development server..."
echo ""
echo "Application will be available at: http://localhost:3000"
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev
