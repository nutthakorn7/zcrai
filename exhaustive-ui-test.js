// Exhaustive UI Button Testing - EVERY button on EVERY page
const { chromium } = require('playwright');
const fs = require('fs');

const BASE_URL = 'https://app.zcr.ai';
const CREDENTIALS = {
  email: 'superadmin@zcr.ai',
  password: 'SuperAdmin@123!'
};

const results = {
  passed: [],
  failed: [],
  screenshots: []
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

// Helper to find and test ALL buttons on a page
async function testAllButtons(page, pageName) {
  console.log(`\n🔍 Finding ALL buttons on ${pageName}...`);
  
  // Get all buttons
  const buttons = await page.locator('button').all();
  console.log(`   Found ${buttons.length} buttons`);
  
  let tested = 0;
  for (let i = 0; i < buttons.length; i++) {
    try {
      const button = buttons[i];
      const isVisible = await button.isVisible().catch(() => false);
      if (!isVisible) continue;
      
      // Get button text/label
      const text = await button.textContent().catch(() => '');
      const ariaLabel = await button.getAttribute('aria-label').catch(() => '');
      const label = text || ariaLabel || `Button-${i}`;
      
      // SKIP logout/sign-out buttons to prevent session loss
      if (label.toLowerCase().includes('logout') || 
          label.toLowerCase().includes('sign out') ||
          label.toLowerCase().includes('log out')) {
        console.log(`   ⏭️  Skipped: "${label}" (logout button)`);
        continue;
      }
      
      // Skip if already tested similar button
      const testName = `${pageName} - ${label.substring(0, 30)}`;
      
      // Click button
      await button.click({ timeout: 3000 });
      await page.waitForTimeout(500);
      
      // Check for errors
      const errorCount = await page.locator('text="Something went wrong"').count();
      if (errorCount > 0) {
        throw new Error('Page crashed after click');
      }
      
      results.passed.push({ test: testName });
      tested++;
      console.log(`   ✅ ${label.substring(0, 40)}`);
      
    } catch (error) {
      const testName = `${pageName} - Button ${i}`;
      results.failed.push({ test: testName, error: error.message });
      console.log(`   ❌ Button ${i}: ${error.message}`);
    }
  }
  
  console.log(`   Tested: ${tested}/${buttons.length} visible buttons`);
}

async function main() {
  if (!fs.existsSync('./exhaustive-test-screenshots')) {
    fs.mkdirSync('./exhaustive-test-screenshots');
  }
  
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
    
    // Test each page exhaustively
    const pages = [
      { url: '/dashboard', name: 'Dashboard' },
      { url: '/detection', name: 'Detection Rules' },
      { url: '/alerts', name: 'Alerts' },
      { url: '/cases', name: 'Cases' },
      { url: '/playbooks', name: 'Playbooks' },
      { url: '/logs', name: 'Logs' },
      { url: '/observables', name: 'Observables' },
      { url: '/settings/integrations', name: 'Settings-Integrations' },
      { url: '/settings/users', name: 'Settings-Users' },
      { url: '/settings/notifications', name: 'Settings-Notifications' },
      { url: '/settings/system', name: 'Settings-System' },
      { url: '/reports', name: 'Reports' },
      { url: '/profile', name: 'Profile' }
    ];
    
    for (const pageInfo of pages) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📄 Testing: ${pageInfo.name}`);
      console.log('='.repeat(60));
      
      // Navigate to page
      await page.goto(`${BASE_URL}${pageInfo.url}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Check if logged out (if we see login form)
      const loginForm = await page.locator('input[type="email"]').count();
      if (loginForm > 0) {
        console.log('   🔄 Re-logging in...');
        await login(page);
        await page.goto(`${BASE_URL}${pageInfo.url}`);
        await page.waitForLoadState('networkidle');
      }
      
      await testAllButtons(page, pageInfo.name);
      
      // Take screenshot
      const screenshotPath = `./exhaustive-test-screenshots/${pageInfo.name.replace(/[^a-z0-9]/gi, '_')}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await browser.close();
    
    // Generate report
    console.log('\n' + '='.repeat(60));
    console.log('📊 EXHAUSTIVE TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`📸 Screenshots: ${pages.length}`);
    
    if (results.failed.length > 0) {
      console.log('\n❌ Failed Tests:');
      results.failed.forEach(({ test, error }) => {
        console.log(`  - ${test}: ${error}`);
      });
    }
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.passed.length + results.failed.length,
        passed: results.passed.length,
        failed: results.failed.length,
        pagesTested: pages.length
      },
      passed: results.passed,
      failed: results.failed
    };
    
    fs.writeFileSync('./exhaustive-test-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Report: exhaustive-test-report.json');
  }
}

main().catch(console.error);
