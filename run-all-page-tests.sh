#!/bin/bash
# Run all page tests sequentially

echo "🚀 Starting Page-by-Page Button Verification"
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
  node test-page.js "$page"
  
  # Small delay between pages
  sleep 2
done

echo ""
echo "=============================================="
echo "✅ All page tests completed!"
echo "=============================================="
echo ""
echo "📊 Generating summary report..."

# Generate summary
node -e "
const fs = require('fs');
const results = [];

const pages = [
  'dashboard', 'detection', 'alerts', 'cases', 'playbooks', 
  'logs', 'observables', 'settings-integrations', 'settings-users',
  'settings-notifications', 'settings-system', 'reports', 'profile'
];

let totalButtons = 0;
let totalClickable = 0;
let totalFailed = 0;

pages.forEach(page => {
  try {
    const data = JSON.parse(fs.readFileSync(\`./page-test-results/\${page}.json\`, 'utf8'));
    results.push(data);
    totalButtons += data.total;
    totalClickable += data.clickable;
    totalFailed += data.failed;
  } catch (e) {
    console.log(\`Warning: Could not load results for \${page}\`);
  }
});

console.log('');
console.log('📊 OVERALL SUMMARY');
console.log('='.repeat(70));
console.log(\`Total Pages Tested: \${results.length}\`);
console.log(\`Total Buttons Found: \${totalButtons}\`);
console.log(\`✅ Clickable Buttons: \${totalClickable}\`);
console.log(\`❌ Failed Buttons: \${totalFailed}\`);
console.log(\`Success Rate: \${((totalClickable / totalButtons) * 100).toFixed(1)}%\`);
console.log('='.repeat(70));
console.log('');
console.log('📄 Per-Page Results:');
console.log('');

results.forEach((r, i) => {
  const rate = ((r.clickable / r.visible) * 100).toFixed(0);
  const status = r.failed === 0 ? '✅' : '⚠️';
  console.log(\`  \${status} \${r.page.padEnd(30)} | Buttons: \${r.total.toString().padStart(3)} | Clickable: \${r.clickable.toString().padStart(3)} | Failed: \${r.failed.toString().padStart(2)} | \${rate}%\`);
});

// Save summary
fs.writeFileSync('./page-test-results/SUMMARY.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  totalPages: results.length,
  totalButtons,
  totalClickable,
  totalFailed,
  successRate: ((totalClickable / totalButtons) * 100).toFixed(1),
  pages: results
}, null, 2));

console.log('');
console.log('📄 Full summary saved: ./page-test-results/SUMMARY.json');
"

echo ""
echo "✅ Done! Check ./page-test-results/ for detailed reports"
