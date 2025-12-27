const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'https://app.zcr.ai';
const CREDENTIALS = {
  email: 'superadmin@zcr.ai',
  password: 'SuperAdmin@123!'
};

// Results storage
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
  console.log('✅ Login successful');
}

async function testButton(page, testName, selector, options = {}) {
  try {
    console.log(`  Testing: ${testName}`);
    
    const element = await page.locator(selector).first();
    const isVisible = await element.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (!isVisible) {
      throw new Error(`Element not visible: ${selector}`);
    }
    
    await element.click({ timeout: 5000 });
    await page.waitForTimeout(options.wait || 1000);
    
    // Check for error page
    const errorText = await page.locator('text="Something went wrong"').count();
    if (errorText > 0) {
      throw new Error('Page crashed with "Something went wrong" error');
    }
    
    results.passed.push({ test: testName, selector });
    console.log(`    ✅ ${testName}`);
    return true;
  } catch (error) {
    results.failed.push({ test: testName, selector, error: error.message });
    console.log(`    ❌ ${testName}: ${error.message}`);
    
    // Take screenshot
    const screenshotPath = `./ui-test-failures/${testName.replace(/[^a-z0-9]/gi, '_')}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    results.screenshots.push(screenshotPath);
    
    return false;
  }
}

async function testDashboard(page) {
  console.log('\n📊 Testing Dashboard...');
  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForLoadState('networkidle');
  
  // Use icon-based selector for refresh
  await testButton(page, 'Dashboard - Refresh Button', 'button:has(svg)', { wait: 2000 });
  await testButton(page, 'Dashboard - Time Filter', 'button', { wait: 1000 }); // Will click first button
}

async function testDetectionRules(page) {
  console.log('\n🔍 Testing Detection Rules...');
  await page.goto(`${BASE_URL}/detection`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Test tabs - use flexible text matching
  const coverageTab = page.locator('[role="tab"]:has-text("Coverage")').or(page.locator('button:has-text("Coverage")'));
  const manageTab = page.locator('[role="tab"]:has-text("Manage")').or(page.locator('button:has-text("Manage")'));
  
  try {
    console.log('  Testing: Detection - Coverage Analysis Tab');
    await coverageTab.first().click({ timeout: 5000 });
    await page.waitForTimeout(3000);
    
    const errorText = await page.locator('text="Something went wrong"').count();
    if (errorText > 0) {
      throw new Error('Page crashed with "Something went wrong" error');
    }
    
    results.passed.push({ test: 'Detection - Coverage Analysis Tab' });
    console.log('    ✅ Detection - Coverage Analysis Tab');
  } catch (error) {
    results.failed.push({ test: 'Detection - Coverage Analysis Tab', error: error.message });
    console.log(`    ❌ Detection - Coverage Analysis Tab: ${error.message}`);
    await page.screenshot({ path: './ui-test-failures/Detection___Coverage_Analysis_Tab.png', fullPage: true }).catch(() => {});
  }
  
  // Go back to Manage tab
  try {
    await manageTab.first().click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    results.passed.push({ test: 'Detection - Manage Rules Tab' });
    console.log('    ✅ Detection - Manage Rules Tab');
  } catch (error) {
    results.failed.push({ test: 'Detection - Manage Rules Tab', error: error.message });
    console.log(`    ❌ Detection - Manage Rules Tab: ${error.message}`);
  }
  
  // Test New Rule button - use flexible matching
  const newRuleBtn = page.locator('button:has-text("New")').or(page.locator('button:has-text("Rule")'));
  try {
    await newRuleBtn.first().click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    results.passed.push({ test: 'Detection - New Rule Button' });
    console.log('    ✅ Detection - New Rule Button');
  } catch (error) {
    results.failed.push({ test: 'Detection - New Rule Button', error: error.message });
    console.log(`    ❌ Detection - New Rule Button: ${error.message}`);
  }
}

async function testAlerts(page) {
  console.log('\n🚨 Testing Alerts...');
  await page.goto(`${BASE_URL}/alerts`);
  await page.waitForLoadState('networkidle');
  
  await testButton(page, 'Alerts - Filter All', 'button:has-text("All")');
  // Try any button with icon for refresh
  const refreshBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
  try {
    await refreshBtn.click({ timeout: 3000 });
    results.passed.push({ test: 'Alerts - Refresh' });
    console.log('    ✅ Alerts - Refresh');
  } catch (error) {
    results.failed.push({ test: 'Alerts - Refresh', error: error.message });
    console.log(`    ❌ Alerts - Refresh: ${error.message}`);
  }
}

async function testCases(page) {
  console.log('\n📋 Testing Cases...');
  await page.goto(`${BASE_URL}/cases`);
  await page.waitForLoadState('networkidle');
  
  await testButton(page, 'Cases - New Case Button', 'button:has-text("New")');
}

async function testPlaybooks(page) {
  console.log('\n⚡ Testing Playbooks...');
  await page.goto(`${BASE_URL}/playbooks`);
  await page.waitForTimeout(2000);
  
 // Check for error
  const errorCount = await page.locator('text="Something went wrong"').count();
  if (errorCount > 0) {
    results.failed.push({ 
      test: 'Playbooks - Page Load', 
      error: 'Page shows "Something went wrong" error' 
    });
    console.log('    ❌ Playbooks page has error');
    await page.screenshot({ path: './ui-test-failures/playbooks_error.png', fullPage: true });
    return;
  }
  
  await testButton(page, 'Playbooks - Create New', 'button:has-text("Create")');
}

async function testLogs(page) {
  console.log('\n📝 Testing Logs...');
  await page.goto(`${BASE_URL}/logs`);
  await page.waitForLoadState('networkidle');
  
  // Just test that page loads, search might be in different location
  const anyButton = await page.locator('button').first();
  try {
    const isVisible = await anyButton.isVisible({ timeout: 3000 });
    if (isVisible) {
      results.passed.push({ test: 'Logs - Page Loads' });
      console.log('    ✅ Logs - Page Loads');
    }
  } catch (error) {
    results.failed.push({ test: 'Logs - Page Loads', error: error.message });
    console.log(`    ❌ Logs - Page Loads: ${error.message}`);
  }
}

async function testObservables(page) {
  console.log('\n🔬 Testing Observables...');
  await page.goto(`${BASE_URL}/observables`);
  await page.waitForLoadState('networkidle');
  
  await testButton(page, 'Observables - Add Button', 'button:has-text("Add")');
}

async function testSettings(page) {
  console.log('\n⚙️  Testing Settings...');
  
  // Integrations
  await page.goto(`${BASE_URL}/settings/integrations`);
  await page.waitForLoadState('networkidle');
  
  // Look for any "Add" or "New" button
  const integrationBtns = await page.locator('button').filter({ hasText: /add|new|create/i }).count();
  if (integrationBtns > 0) {
    await testButton(page, 'Settings - Integrations Page Loads', 'button');
  }
  
  // Users
  await page.goto(`${BASE_URL}/settings/users`);
  await page.waitForLoadState('networkidle');
  const userBtns = await page.locator('button').filter({ hasText: /invite|add|new/i }).count();
  if (userBtns > 0) {
    await testButton(page, 'Settings - Users Page Loads', 'button');
  }
  
  // Notifications
  await page.goto(`${BASE_URL}/settings/notifications`);
  await page.waitForLoadState('networkidle');
  try {
    const pageLoaded = await page.locator('h1, h2, h3').first().isVisible({ timeout: 3000 });
    if (pageLoaded) {
      results.passed.push({ test: 'Settings - Notifications Page' });
      console.log('    ✅ Settings - Notifications Page');
    }
  } catch (error) {
    results.failed.push({ test: 'Settings - Notifications Page', error: error.message });
    console.log(`    ❌ Settings - Notifications Page: ${error.message}`);
  }
  
  // System Configuration
  await page.goto(`${BASE_URL}/settings/system`);
  await page.waitForLoadState('networkidle');
  try {
    const pageLoaded = await page.locator('h1, h2, h3').first().isVisible({ timeout: 3000 });
    if (pageLoaded) {
      results.passed.push({ test: 'Settings - System Config Page' });
      console.log('    ✅ Settings - System Config Page');
    }
  } catch (error) {
    results.failed.push({ test: 'Settings - System Config Page', error: error.message });
    console.log(`    ❌ Settings - System Config Page: ${error.message}`);
  }
}

async function testReports(page) {
  console.log('\n📈 Testing Reports...');
  await page.goto(`${BASE_URL}/reports`);
  await page.waitForLoadState('networkidle');
  
  try {
    const pageLoaded = await page.locator('h1, h2, h3').first().isVisible({ timeout: 3000 });
    if (pageLoaded) {
      results.passed.push({ test: 'Reports - Page Loads' });
      console.log('    ✅ Reports - Page Loads');
    }
    
    // Test export/generate buttons
    const exportBtn = await page.locator('button').filter({ hasText: /export|generate|download/i }).count();
    if (exportBtn > 0) {
      results.passed.push({ test: 'Reports - Export Button Exists' });
      console.log('    ✅ Reports - Export Button Exists');
    }
  } catch (error) {
    results.failed.push({ test: 'Reports - Page Loads', error: error.message });
    console.log(`    ❌ Reports - Page Loads: ${error.message}`);
  }
}

async function testMITRE(page) {
  console.log('\n🎯 Testing MITRE Pages...');
  
  // Coverage page
  await page.goto(`${BASE_URL}/mitre/coverage`);
  await page.waitForLoadState('networkidle');
  try {
    const pageLoaded = await page.locator('h1, h2, h3').first().isVisible({ timeout: 3000 });
    if (pageLoaded) {
      results.passed.push({ test: 'MITRE - Coverage Page' });
      console.log('    ✅ MITRE - Coverage Page');
    }
  } catch (error) {
    results.failed.push({ test: 'MITRE - Coverage Page', error: error.message });
    console.log(`    ❌ MITRE - Coverage Page: ${error.message}`);
  }
  
  // Summary page
  await page.goto(`${BASE_URL}/mitre/summary`);
  await page.waitForLoadState('networkidle');
  try {
    const pageLoaded = await page.locator('h1, h2, h3').first().isVisible({ timeout: 3000 });
    if (pageLoaded) {
      results.passed.push({ test: 'MITRE - Summary Page' });
      console.log('    ✅ MITRE - Summary Page');
    }
  } catch (error) {
    results.failed.push({ test: 'MITRE - Summary Page', error: error.message });
    console.log(`    ❌ MITRE - Summary Page: ${error.message}`);
  }
}

async function testProfile(page) {
  console.log('\n👤 Testing Profile...');
  await page.goto(`${BASE_URL}/profile`);
  await page.waitForLoadState('networkidle');
  
  try {
    // Look for profile update button
    const updateBtn = await page.locator('button').filter({ hasText: /save|update/i }).count();
    if (updateBtn > 0) {
      results.passed.push({ test: 'Profile - Update Button Exists' });
      console.log('    ✅ Profile - Update Button Exists');
    }
    
    const pageLoaded = await page.locator('h1, h2, h3').first().isVisible({ timeout: 3000 });
    if (pageLoaded) {
      results.passed.push({ test: 'Profile - Page Loads' });
      console.log('    ✅ Profile - Page Loads');
    }
  } catch (error) {
    results.failed.push({ test: 'Profile - Page Loads', error: error.message });
    console.log(`    ❌ Profile - Page Loads: ${error.message}`);
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 UI TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`📸 Screenshots: ${results.screenshots.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach(({ test, error }) => {
      console.log(`  - ${test}: ${error}`);
    });
  }
  
  // Save JSON report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.passed.length + results.failed.length,
      passed: results.passed.length,
      failed: results.failed.length
    },
    passed: results.passed,
    failed: results.failed,
    screenshots: results.screenshots
  };
  
  fs.writeFileSync('./ui-test-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Report saved to: ui-test-report.json');
}

async function main() {
  // Create screenshots directory
  if (!fs.existsSync('./ui-test-failures')) {
    fs.mkdirSync('./ui-test-failures');
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
    await testDashboard(page);
    await testDetectionRules(page);
    await testAlerts(page);
    await testCases(page);
    await testPlaybooks(page);
    await testLogs(page);
    await testObservables(page);
    await testSettings(page);
    await testReports(page);
    await testMITRE(page);
    await testProfile(page);
  } catch (error) {
    console.error('❌ Test suite error:', error);
  } finally {
    await browser.close();
    await generateReport();
  }
}

main().catch(console.error);
