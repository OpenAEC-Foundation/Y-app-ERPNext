import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
page.on('pageerror', err => errors.push(err.message));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
});

await page.goto('http://localhost:3500', { timeout: 15000, waitUntil: 'networkidle' });

// Navigate to Email page
const emailBtn = page.locator('button:has-text("Email")');
await emailBtn.click();
console.log('Clicked Email button');

// Wait for emails to load (wait for message items to appear)
try {
  await page.waitForSelector('[draggable="true"]', { timeout: 15000 });
  console.log('Messages loaded');
} catch {
  console.log('Timeout waiting for messages, taking screenshot anyway');
}

await page.waitForTimeout(2000);
await page.screenshot({ path: 'test-screenshot-email.png', fullPage: true });
console.log('Screenshot saved: test-screenshot-email.png');

const rootHTML = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length || 0);
console.log(`Root HTML length: ${rootHTML}`);

// Check for date group headers
const headers = await page.evaluate(() => {
  const els = document.querySelectorAll('.sticky span');
  return Array.from(els).map(el => el.textContent);
});
console.log('Date group headers:', headers);

if (errors.length > 0) {
  console.log('\n=== ERRORS ===');
  errors.forEach(e => console.log(e));
} else {
  console.log('\nNo errors.');
}

await browser.close();
