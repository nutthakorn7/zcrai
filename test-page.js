// Page-by-Page UI Button Verification
// Usage: node test-page.js <page-name>
// Example: node test-page.js dashboard

const { chromium } = require('playwright');
const fs = require('fs');

const BASE_URL = 'https://app.zcr.ai';
const CREDENTIALS = {
  email: 'superadmin@zcr.ai',
  password: 'SuperAdmin@123!'
};

// Page configurations
const PAGES = {
  dashboard: { url: '/dashboard', name: 'Dashboard' },
  detection: { url: '/detection', name: 'Detection Rules' },
  alerts: { url: '/alerts', name: 'Alerts' },
  cases: { url: '/cases', name: 'Cases' },
  playbooks: { url: '/playbooks', name: 'Playbooks' },
  logs: { url: '/logs', name: 'Logs' },
  observables: { url: '/observables', name: 'Observables' },
  'settings-integrations': { url: '/settings/integrations', name: 'Settings - Integrations' },
  'settings-users': { url: '/settings/users', name: 'Settings - Users' },
  'settings-notifications': { url: '/settings/notifications', name: 'Settings - Notifications' },
  'settings-system': { url: '/settings/system', name: 'Settings - System' },
  reports: { url: '/reports', name: 'Reports' },
  'mitre-coverage': { url: '/mitre/coverage', name: 'MITRE Coverage' },
  'mitre-summary': { url: '/mitre/summary', name: 'MITRE Summary' },
  profile: { url: '/profile', name: 'Profile' }
};

async function login(page) {
  console.log('🔐 Logging in...');
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', CREDENTIALS.email);
  await page.fill('input[type="password"]', CREDENTIALS.password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  console.log('✅ Login successful\n');
}

async function testPageButtons(page, pageName, pageUrl) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📄 Testing: ${pageName}`);
  console.log('='.repeat(70));
  
  // Navigate to page
  await page.goto(`${BASE_URL}${pageUrl}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // Wait for animations
  
  // Take initial screenshot
  const screenshotDir = './page-screenshots';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
  }
  await page.screenshot({ 
    path: `${screenshotDir}/${pageName.replace(/[^a-z0-9]/gi, '_')}.png`,
    fullPage: true 
  });
  
  // Find all buttons
  const allButtons = await page.locator('button').all();
  console.log(`\n🔍 Found ${allButtons.length} total buttons`);
  
  const buttons = [];
  const results = {
    total: allButtons.length,
    visible: 0,
    clickable: 0,
    failed: 0,
    skipped: 0,
    buttons: []
  };
  
  // Analyze each button
  for (let i = 0; i < allButtons.length; i++) {
    const button = allButtons[i];
    
    try {
      const isVisible = await button.isVisible().catch(() => false);
      if (!isVisible) {
        results.skipped++;
        continue;
      }
      
      results.visible++;
      
      // Get button details
      const text = await button.textContent().catch(() => '');
      const ariaLabel = await button.getAttribute('aria-label').catch(() => '');
      const className = await button.getAttribute('class').catch(() => '');
      const type = await button.getAttribute('type').catch(() => '');
      
      const buttonInfo = {
        index: i,
        text: text?.trim() || '',
        ariaLabel: ariaLabel || '',
        type: type || 'button',
        className: className || '',
        status: 'unknown'
      };
      
      // Skip logout buttons
      const label = buttonInfo.text + ' ' + buttonInfo.ariaLabel;
      if (label.toLowerCase().includes('logout') || 
          label.toLowerCase().includes('sign out') ||
          label.toLowerCase().includes('log out')) {
        buttonInfo.status = 'skipped-logout';
        results.skipped++;
        console.log(`   ⏭️  [${i}] Skipped: "${buttonInfo.text || buttonInfo.ariaLabel}" (logout)`);
        buttons.push(buttonInfo);
        continue;
      }
      
      // Try to click
      try {
        await button.click({ timeout: 2000 });
        await page.waitForTimeout(300);
        
        // Check for crash
        const crashed = await page.locator('text="Something went wrong"').count();
        if (crashed > 0) {
          buttonInfo.status = 'crashed';
          results.failed++;
          console.log(`   ❌ [${i}] CRASH: "${buttonInfo.text || buttonInfo.ariaLabel}"`);
          
          // Take crash screenshot
          await page.screenshot({ 
            path: `${screenshotDir}/${pageName.replace(/[^a-z0-9]/gi, '_')}_crash_btn${i}.png` 
          });
          
          // Reload page
          await page.goto(`${BASE_URL}${pageUrl}`);
          await page.waitForLoadState('networkidle');
        } else {
          buttonInfo.status = 'clickable';
          results.clickable++;
          console.log(`   ✅ [${i}] "${buttonInfo.text || buttonInfo.ariaLabel || 'Button'}"`);
        }
      } catch (error) {
        buttonInfo.status = 'error';
        buttonInfo.error = error.message;
        results.failed++;
        console.log(`   ⚠️  [${i}] Error: "${buttonInfo.text || buttonInfo.ariaLabel}" - ${error.message.substring(0, 50)}`);
      }
      
      buttons.push(buttonInfo);
      
    } catch (error) {
      console.log(`   ⚠️  [${i}] Failed to analyze: ${error.message}`);
    }
  }
  
  // Summary
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`📊 Summary for ${pageName}:`);
  console.log(`   Total buttons: ${results.total}`);
  console.log(`   Visible: ${results.visible}`);
  console.log(`   ✅ Clickable: ${results.clickable}`);
  console.log(`   ❌ Failed/Error: ${results.failed}`);
  console.log(`   ⏭️  Skipped: ${results.skipped}`);
  console.log('='.repeat(70));
  
  return {
    page: pageName,
    url: pageUrl,
    ...results,
    buttons
  };
}

async function main() {
  const pageName = process.argv[2];
  
  if (!pageName || !PAGES[pageName]) {
    console.log('Usage: node test-page.js <page-name>');
    console.log('\nAvailable pages:');
    Object.keys(PAGES).forEach(key => {
      console.log(`  - ${key}: ${PAGES[key].name}`);
    });
    process.exit(1);
  }
  
  const pageConfig = PAGES[pageName];
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    await login(page);
    const result = await testPageButtons(page, pageConfig.name, pageConfig.url);
    
    // Save result
    const reportDir = './page-test-results';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir);
    }
    
    fs.writeFileSync(
      `${reportDir}/${pageName}.json`,
      JSON.stringify(result, null, 2)
    );
    
    console.log(`\n📄 Report saved: ${reportDir}/${pageName}.json`);
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
