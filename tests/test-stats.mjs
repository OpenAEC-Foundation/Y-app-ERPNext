import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
page.on('pageerror', err => errors.push(err.message));

await page.goto('http://localhost:3500', { timeout: 15000, waitUntil: 'networkidle' });

// Navigate to Statistieken
await page.locator('button:has-text("Statistieken")').click();
await page.waitForTimeout(5000);

await page.screenshot({ path: 'test-screenshot-stats.png', fullPage: true });
console.log('Stats screenshot saved');

const rootHTML = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length || 0);
console.log(`Root HTML length: ${rootHTML}`);

if (errors.length > 0) {
  console.log('\n=== ERRORS ===');
  errors.forEach(e => console.log(e));
} else {
  console.log('No errors.');
}

await browser.close();
