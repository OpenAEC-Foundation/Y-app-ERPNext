import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

const errors = [];
page.on('pageerror', err => errors.push(err.message));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
});

console.log('Opening http://localhost:3500 ...');
await page.goto('http://localhost:3500', { timeout: 15000, waitUntil: 'networkidle' });

// Check if root has content
const rootHTML = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length || 0);
console.log(`Root HTML length: ${rootHTML} chars`);
if (rootHTML < 100) {
  console.log('ERROR: Page appears empty!');
  console.log('Root content:', await page.evaluate(() => document.getElementById('root')?.innerHTML));
}

// Take screenshot
await page.screenshot({ path: 'test-screenshot-home.png', fullPage: true });
console.log('Screenshot saved: test-screenshot-home.png');

// Check visible text
const bodyText = await page.evaluate(() => document.body.innerText?.substring(0, 500));
console.log('\nVisible text (first 500 chars):');
console.log(bodyText);

// Wait so user can see the browser
console.log('\nBrowser is open - check it visually. Closing in 15 seconds...');
await new Promise(r => setTimeout(r, 15000));

if (errors.length > 0) {
  console.log('\n=== ERRORS ===');
  errors.forEach(e => console.log(e));
} else {
  console.log('\nNo errors detected.');
}

await browser.close();
