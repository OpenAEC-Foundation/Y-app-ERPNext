import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
page.on('pageerror', err => errors.push(err.message));

await page.goto('http://localhost:3500', { timeout: 15000, waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Test 1: Dashboard with sidebar expanded
await page.screenshot({ path: 'test-ss-sidebar-expanded.png', fullPage: true });
console.log('1. Dashboard with sidebar expanded - saved');

// Test 2: Click collapse button (bottom of sidebar)
const collapseBtn = page.locator('aside > button').last();
await collapseBtn.click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'test-ss-sidebar-collapsed.png', fullPage: true });
console.log('2. Dashboard with sidebar collapsed - saved');

// Test 3: Navigate to email with collapsed sidebar (use title)
await page.locator('aside button[title="Email"]').click();
await page.waitForTimeout(5000);
await page.screenshot({ path: 'test-ss-email-collapsed.png', fullPage: true });
console.log('3. Email with collapsed sidebar - saved');

// Test 4: Expand sidebar again
const expandBtn = page.locator('aside > button').last();
await expandBtn.click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'test-ss-email-expanded.png', fullPage: true });
console.log('4. Email with expanded sidebar - saved');

// Test 5: Stats page (verify data loads)
await page.locator('button:has-text("Statistieken")').first().click();
await page.waitForTimeout(5000);
await page.screenshot({ path: 'test-ss-stats-fixed.png', fullPage: true });
console.log('5. Stats page - saved');

console.log('\n=== SUMMARY ===');
if (errors.length > 0) {
  console.log(`PAGE ERRORS: ${errors.length}`);
  errors.forEach(e => console.log('  ' + e));
} else {
  console.log('No page errors');
}

await browser.close();
