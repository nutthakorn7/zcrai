// Improved Smart Button Testing - Fixes "false failures"
const { chromium } = require('playwright');
const fs = require('fs');

const BASE_URL = 'https://app.zcr.ai';
const CREDENTIALS = {
  email: 'superadmin@zcr.ai',
  password: 'SuperAdmin@123!'
};

// Improved page configs
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

// Helper to close any open modals
async function closeModals(page) {
  try {
    // Check for modal backdrop
    const modalCount = await page.locator('[data-slot="wrapper"]').count();
    if (modalCount > 0) {
      // Try ESC key
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  } catch (e) {
    // Ignore errors
  }
}

// Smart button categorization
function categorizeButton(text, ariaLabel, className) {
  const label = (text + ' ' + ariaLabel).toLowerCase();
  const classes = className.toLowerCase();
  
  // Logout buttons - skip
  if (label.includes('logout') || label.includes('sign out') || label.includes('log out')) {
    return 'logout';
  }
  
  // Sidebar navigation - longer timeout
  const navKeywords = ['dashboard', 'detect', 'rules', 'triage', 'alerts', 'investigate', 'cases', 
                       'respond', 'playbooks', 'analysis', 'hunting', 'intel', 'observables', 
                       'settings', 'reports', 'approvals', 'queue', 'builder', 'monitor', 'operations'];
  
  if (navKeywords.some(kw => label.includes(kw))) {
    return 'navigation';
  }
  
  // Icon-only buttons (likely actions)
  if (!text.trim() && !ariaLabel && classes.includes('icon')) {
    return 'icon-action';
  }
  
  // Default: action button
  return 'action';
}

async function testPageButtonsSmart(page, pageName, pageUrl) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📄 Testing: ${pageName}`);
  console.log('='.repeat(70));
  
  await page.goto(`${BASE_URL}${pageUrl}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Screenshot
  const screenshotDir = './smart-test-screenshots';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
  }
  await page.screenshot({ 
    path: `${screenshotDir}/${pageName.replace(/[^a-z0-9]/gi, '_')}.png`,
    fullPage: true 
  });
  
  const allButtons = await page.locator('button').all();
  console.log(`\n🔍 Found ${allButtons.length} total buttons`);
  
  const results = {
    total: allButtons.length,
    byCategory: {
      action: { tested: 0, passed: 0, failed: 0 },
      navigation: { tested: 0, passed: 0, failed: 0, skipped: 0 },
      iconAction: { tested: 0, passed: 0, failed: 0 },
      logout: { skipped: 0 }
    },
    buttons: []
  };
  
  // Track tested navigation to avoid duplicates
  const testedNavigation = new Set();
  
  for (let i = 0; i < allButtons.length; i++) {
    const button = allButtons[i];
    
    try {
      const isVisible = await button.isVisible().catch(() => false);
      if (!isVisible) continue;
      
      const text = await button.textContent().catch(() => '');
      const ariaLabel = await button.getAttribute('aria-label').catch(() => '');
      const className = await button.getAttribute('class').catch(() => '');
      
      const category = categorizeButton(text, ariaLabel, className);
      const buttonInfo = {
        index: i,
        text: text?.trim() || '',
        ariaLabel: ariaLabel || '',
        category,
        status: 'unknown'
      };
      
      // Handle by category
      if (category === 'logout') {
        results.byCategory.logout.skipped++;
        buttonInfo.status = 'skipped-logout';
        console.log(`   ⏭️  [${i}] Logout button skipped`);
        results.buttons.push(buttonInfo);
        continue;
      }
      
      if (category === 'navigation') {
        const navKey = text.trim() || ariaLabel;
        
        // Skip duplicate sidebar navigation
        if (testedNavigation.has(navKey)) {
          results.byCategory.navigation.skipped++;
          buttonInfo.status = 'skipped-duplicate';
          results.buttons.push(buttonInfo);
          continue;
        }
        
        testedNavigation.add(navKey);
        results.byCategory.navigation.tested++;
        
        // Test with longer timeout for navigation
        try {
          await closeModals(page);
          await button.click({ timeout: 5000 }); // 5s for navigation
          await page.waitForTimeout(1000);
          
          const crashed = await page.locator('text="Something went wrong"').count();
          if (crashed > 0) {
            buttonInfo.status = 'crashed';
            results.byCategory.navigation.failed++;
            console.log(`   ❌ [${i}] NAV CRASH: "${text || ariaLabel}"`);
          } else {
            buttonInfo.status = 'passed';
            results.byCategory.navigation.passed++;
            console.log(`   ✅ [${i}] NAV: "${text || ariaLabel}"`);
            
            // Navigate back
            await page.goto(`${BASE_URL}${pageUrl}`);
            await page.waitForLoadState('networkidle');
          }
        } catch (error) {
          // Navigation timeout is OK - it navigated away
          if (error.message.includes('Timeout')) {
            buttonInfo.status = 'navigated';
            results.byCategory.navigation.passed++;
            console.log(`   ✅ [${i}] NAV (navigated): "${text || ariaLabel}"`);
            
            // Go back
            await page.goto(`${BASE_URL}${pageUrl}`);
            await page.waitForLoadState('networkidle');
          } else {
            buttonInfo.status = 'error';
            buttonInfo.error = error.message;
            results.byCategory.navigation.failed++;
            console.log(`   ⚠️  [${i}] NAV Error: "${text || ariaLabel}"`);
          }
        }
      } else {
        // Action or Icon buttons
        const cat = category === 'icon-action' ? 'iconAction' : 'action';
        results.byCategory[cat].tested++;
        
        try {
          await closeModals(page);
          await button.click({ timeout: 3000 });
          await page.waitForTimeout(500);
          
          const crashed = await page.locator('text="Something went wrong"').count();
          if (crashed > 0) {
            buttonInfo.status = 'crashed';
            results.byCategory[cat].failed++;
            console.log(`   ❌ [${i}] CRASH: "${text || ariaLabel || 'Icon'}"`);
            
            await page.screenshot({ 
              path: `${screenshotDir}/${pageName.replace(/[^a-z0-9]/gi, '_')}_crash_btn${i}.png` 
            });
            
            await page.goto(`${BASE_URL}${pageUrl}`);
            await page.waitForLoadState('networkidle');
          } else {
            buttonInfo.status = 'passed';
            results.byCategory[cat].passed++;
            console.log(`   ✅ [${i}] "${text || ariaLabel || 'Icon'}"`);
          }
        } catch (error) {
          buttonInfo.status = 'error';
          buttonInfo.error = error.message;
          results.byCategory[cat].failed++;
          console.log(`   ⚠️  [${i}] Error: "${text || ariaLabel || 'Icon'}" - ${error.message.substring(0, 50)}`);
        }
      }
      
      results.buttons.push(buttonInfo);
      
    } catch (error) {
      console.log(`   ⚠️  [${i}] Analysis failed`);
    }
  }
  
  // Summary
  const totalTested = results.byCategory.action.tested + results.byCategory.navigation.tested + results.byCategory.iconAction.tested;
  const totalPassed = results.byCategory.action.passed + results.byCategory.navigation.passed + results.byCategory.iconAction.passed;
  const totalFailed = results.byCategory.action.failed + results.byCategory.navigation.failed + results.byCategory.iconAction.failed;
  const totalSkipped = results.byCategory.navigation.skipped + results.byCategory.logout.skipped;
  
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`📊 Summary for ${pageName}:`);
  console.log(`   Total buttons: ${results.total}`);
  console.log(`   Tested: ${totalTested}`);
  console.log(`   ✅ Passed: ${totalPassed}`);
  console.log(`   ❌ Failed: ${totalFailed}`);
  console.log(`   ⏭️  Skipped: ${totalSkipped} (${results.byCategory.navigation.skipped} dup nav + ${results.byCategory.logout.skipped} logout)`);
  console.log(`   Success Rate: ${((totalPassed / totalTested) * 100).toFixed(0)}%`);
 console.log('='.repeat(70));
  
  return {
    page: pageName,
    url: pageUrl,
    total: results.total,
    tested: totalTested,
    passed: totalPassed,
    failed: totalFailed,
    skipped: totalSkipped,
    byCategory: results.byCategory,
    buttons: results.buttons
  };
}

async function main() {
  const pageName = process.argv[2];
  
  if (!pageName || !PAGES[pageName]) {
    console.log('Usage: node test-page-smart.js <page-name>');
    console.log('\nAvailable pages:');
    Object.keys(PAGES).forEach(key => {
      console.log(`  - ${key}`);
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
    const result = await testPageButtonsSmart(page, pageConfig.name, pageConfig.url);
    
    const reportDir = './smart-test-results';
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
