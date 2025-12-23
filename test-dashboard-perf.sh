#!/bin/bash
# Test Dashboard API Performance

SERVER="https://app.zcr.ai"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." # Will need actual token

echo "🧪 Testing Dashboard API Performance..."
echo "========================================"
echo ""

# Test 1: Summary
echo "📊 Test 1: Dashboard Summary"
time curl -s -w "\nTime: %{time_total}s\n" \
  -H "Cookie: access_token=$TOKEN" \
  "$SERVER/api/dashboard/summary?startDate=2025-12-01&endDate=2025-12-23" \
  > /dev/null

echo ""

# Test 2: Timeline
echo "📈 Test 2: Timeline"
time curl -s -w "\nTime: %{time_total}s\n" \
  -H "Cookie: access_token=$TOKEN" \
  "$SERVER/api/dashboard/timeline?startDate=2025-12-01&endDate=2025-12-23" \
  > /dev/null

echo ""

# Test 3: MITRE Heatmap
echo "🎯 Test 3: MITRE Heatmap"
time curl -s -w "\nTime: %{time_total}s\n" \
  -H "Cookie: access_token=$TOKEN" \
  "$SERVER/api/dashboard/mitre-heatmap?startDate=2025-12-01&endDate=2025-12-23" \
  > /dev/null

echo ""

# Test 4: Top Hosts
echo "💻 Test 4: Top Hosts"
time curl -s -w "\nTime: %{time_total}s\n" \
  -H "Cookie: access_token=$TOKEN" \
  "$SERVER/api/dashboard/top-hosts?startDate=2025-12-01&endDate=2025-12-23&limit=10" \
  > /dev/null

echo ""
echo "✅ Performance test complete!"
