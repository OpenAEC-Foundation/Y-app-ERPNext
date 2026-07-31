import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
page.on('pageerror', err => errors.push(err.message));

await page.goto('http://localhost:3500', { timeout: 15000, waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

await page.screenshot({ path: 'test-screenshot-dashboard.png', fullPage: true });
console.log('Dashboard screenshot saved');

const rootHTML = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length || 0);
console.log(`Root HTML length: ${rootHTML}`);

if (errors.length > 0) {
  console.log('\n=== ERRORS ===');
  errors.forEach(e => console.log(e));
} else {
  console.log('No errors.');
}

await browser.close();
