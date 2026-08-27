import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
const logs = [];

page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => errors.push(err.message));

try {
  await page.goto('http://localhost:3500', { timeout: 10000, waitUntil: 'networkidle' });
} catch(e) {
  console.log('Navigation error:', e.message);
}

const rootHTML = await page.evaluate(() => document.getElementById('root')?.innerHTML?.substring(0, 500) || 'EMPTY');

console.log('\n=== CONSOLE LOGS ===');
logs.forEach(l => console.log(l));
console.log('\n=== PAGE ERRORS ===');
errors.forEach(e => console.log(e));
console.log('\n=== ROOT HTML ===');
console.log(rootHTML);

await browser.close();
