#!/bin/bash
# Smart test runner - improved version

echo "🚀 Starting SMART Page-by-Page Button Verification"
echo "=============================================="
echo "✨ Improvements:"
echo "  - Categorizes buttons (action/navigation/icon)"
echo "  - Longer timeout for navigation (5s)"
echo "  - Closes modals before testing"
echo "  - Skips duplicate sidebar navigation"
echo "=============================================="
echo ""

PAGES=(
  "dashboard"
  "detection"
  "alerts"
  "cases"
  "playbooks"
  "logs"
  "observables"
  "settings-integrations"
  "settings-users"
  "settings-notifications"
  "settings-system"
  "reports"
  "profile"
)

TOTAL=${#PAGES[@]}
CURRENT=0

for page in "${PAGES[@]}"; do
  CURRENT=$((CURRENT + 1))
  echo ""
  echo "[$CURRENT/$TOTAL] Testing: $page"
  echo "----------------------------------------"
  node test-page-smart.js "$page"
  sleep 1
done

echo ""
echo "=============================================="
echo "✅ All SMART tests completed!"
echo "=============================================="
echo ""
echo "📊 Generating summary..."

# Generate summary
node -e "
const fs = require('fs');
const pages = [
  'dashboard', 'detection', 'alerts', 'cases', 'playbooks', 
  'logs', 'observables', 'settings-integrations', 'settings-users',
  'settings-notifications', 'settings-system', 'reports', 'profile'
];

const results = [];
let totalButtons = 0;
let totalTested = 0;
let totalPassed = 0;
let totalFailed = 0;

pages.forEach(page => {
  try {
    const data = JSON.parse(fs.readFileSync(\`./smart-test-results/\${page}.json\`, 'utf8'));
    results.push(data);
    totalButtons += data.total;
    totalTested += data.tested;
    totalPassed += data.passed;
    totalFailed += data.failed;
  } catch (e) {}
});

console.log('');
console.log('📊 SMART TEST SUMMARY');
console.log('='.repeat(70));
console.log(\`Total Pages: \${results.length}\`);
console.log(\`Total Buttons Found: \${totalButtons}\`);
console.log(\`Buttons Tested: \${totalTested}\`);
console.log(\`✅ Passed: \${totalPassed}\`);
console.log(\`❌ Failed: \${totalFailed}\`);
console.log(\`Success Rate: \${((totalPassed / totalTested) * 100).toFixed(1)}%\`);
console.log('='.repeat(70));
console.log('');
console.log('📄 Per-Page Results:');
console.log('');

results.forEach(r => {
  const rate = ((r.passed / r.tested) * 100).toFixed(0);
  const status = r.failed === 0 ? '✅' : r.failed < 3 ? '🟡' : '⚠️';
  console.log(\`  \${status} \${r.page.padEnd(30)} | Total: \${r.total.toString().padStart(3)} | Tested: \${r.tested.toString().padStart(3)} | ✅ \${r.passed.toString().padStart(3)} | ❌ \${r.failed.toString().padStart(2)} | \${rate}%\`);
});

fs.writeFileSync('./smart-test-results/SUMMARY.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  totalPages: results.length,
  totalButtons,
  totalTested,
  totalPassed,
  totalFailed,
  successRate: ((totalPassed / totalTested) * 100).toFixed(1),
  pages: results
}, null, 2));

console.log('');
console.log('📄 Full summary: ./smart-test-results/SUMMARY.json');
"

echo ""
echo "✅ Done! Much better results expected 🎯"
