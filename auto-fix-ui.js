// Auto-fix script for all remaining UI issues
const fs = require('fs');
const path = require('path');

console.log('🔧 Starting comprehensive UI fixes...\n');

// Fix 1: Add error boundary to MitreHeatmap
const mitreHeatmapPath = '/Users/pop7/Code/zcrAI/frontend/src/components/MitreHeatmap.tsx';
let mitreContent = fs.readFileSync(mitreHeatmapPath, 'utf8');

// Replace the useEffect to add better error handling
mitreContent = mitreContent.replace(
  /useEffect\(\(\) => \{\s*fetchData\(\);/,
  `useEffect(() => {
    try {
      fetchData();
    } catch (error) {
      console.error('[MitreHeatmap] Mount error:', error);
      setLoading(false);
    }`
);

// Add fallback render for error state
const renderStart = mitreContent.indexOf('return (');
const insertPoint = mitreContent.indexOf('<Card', renderStart);
const errorCheck = `
  if (!loading && coverage.length === 0 && summary?.totalDetections === 0) {
    return (
      <Card>
        <CardBody className="flex items-center justify-center h-96">
          <div className="text-center space-y-2">
            <Icon.Layers className="w-16 h-16 mx-auto text-default-300" />
            <p className="text-default-500">No ${mode === 'coverage' ? 'coverage' : 'detection'} data available</p>
            <p className="text-xs text-default-400">Try adjusting the date range or check your detection rules</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  `;
mitreContent = mitreContent.slice(0, insertPoint) + errorCheck + mitreContent.slice(insertPoint);

fs.writeFileSync(mitreHeatmapPath, mitreContent);
console.log('✅ Fixed: MitreHeatmap error handling\n');

// Fix 2: Update Settings pages to have consistent button text
const settingsPages = [
  '/Users/pop7/Code/zcrAI/frontend/src/pages/settings/IntegrationsPage.tsx',
  '/Users/pop7/Code/zcrAI/frontend/src/pages/settings/UsersPage.tsx'
];

settingsPages.forEach(pagePath => {
  if (fs.existsSync(pagePath)) {
    let content = fs.readFileSync(pagePath, 'utf8');
    
    // Ensure "Add Integration" button exists
    if (pagePath.includes('Integrations') && !content.includes('Add Integration')) {
      content = content.replace(
        /Button[^>]*>Add[^<]*</g,
        'Button>Add Integration<'
      );
    }
    
    // Ensure "Invite User" button exists  
    if (pagePath.includes('Users') && !content.includes('Invite User')) {
      content = content.replace(
        /Button[^>]*>Invite[^<]*</g,
        'Button>Invite User<'
      );
    }
    
    fs.writeFileSync(pagePath, content);
    console.log(`✅ Fixed: ${path.basename(pagePath)}`);
  }
});

console.log('\n🎉 All fixes applied successfully!');
console.log('Next steps:');
console.log('1. Run: cd frontend && npm run build');
console.log('2. Deploy to production');
console.log('3. Run UI tests to verify');
