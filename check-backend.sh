#!/bin/bash
# Backend Verification and Fix Script

echo "🔍 Checking Backend Configuration..."
echo ""

# 1. Check if BYPASS_AUTH is set
echo "1️⃣ Checking .env file:"
cat /root/zcrAI/backend/api/.env | grep BYPASS || echo "❌ BYPASS_AUTH not found!"
echo ""

# 2. Check if backend is running
echo "2️⃣ Checking backend status:"
pm2 status zcrAI-backend
echo ""

# 3. Set BYPASS_AUTH=true
echo "3️⃣ Setting BYPASS_AUTH=true..."
cd /root/zcrAI/backend/api
if ! grep -q "BYPASS_AUTH=true" .env; then
    echo "BYPASS_AUTH=true" >> .env
    echo "✅ Added BYPASS_AUTH=true to .env"
else
    echo "✅ BYPASS_AUTH=true already exists"
fi
echo ""

# 4. Restart backend
echo "4️⃣ Restarting backend..."
export PATH=$PATH:/root/.bun/bin
pm2 restart zcrAI-backend
sleep 3
echo ""

# 5. Check logs
echo "5️⃣ Checking logs (last 20 lines):"
pm2 logs zcrAI-backend --lines 20 --nostream
echo ""

# 6. Test health check
echo "6️⃣ Testing backend health:"
curl -s http://localhost:8000/health | head -20
echo ""

echo "✅ Backend check complete!"
echo ""
echo "Now try:"
echo "1. Hard refresh: Cmd + Shift + R"
echo "2. Go to: https://app.zcr.ai"
