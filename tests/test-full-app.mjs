import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
const failedRequests = [];

page.on('pageerror', err => errors.push(err.message));
page.on('requestfailed', req => failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`));

async function testPage(name, action, screenshotName, waitMs = 3000) {
  console.log(`\n=== ${name} ===`);
  try {
    await action();
    await page.waitForTimeout(waitMs);
    await page.screenshot({ path: `test-ss-${screenshotName}.png`, fullPage: true });
    console.log(`  Screenshot: test-ss-${screenshotName}.png`);
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }
}

// 1. Dashboard
await testPage('Dashboard (Home)',
  () => page.goto('http://localhost:3500', { timeout: 15000, waitUntil: 'networkidle' }),
  '01-dashboard', 3000);

// 2. Statistieken - Overzicht
await testPage('Statistieken - Overzicht',
  () => page.locator('text=Statistieken').first().click(),
  '02-stats-overzicht', 5000);

// 3. Statistieken - Uren tab
await testPage('Statistieken - Uren tab',
  () => page.getByRole('button', { name: 'Uren', exact: true }).click(),
  '03-stats-uren', 3000);

// 4. Statistieken - Bureau Algemeen tab
await testPage('Statistieken - Bureau Algemeen',
  () => page.getByRole('button', { name: 'Bureau Algemeen' }).click(),
  '04-stats-bureau', 3000);

// 5. Statistieken - Leveringen tab
await testPage('Statistieken - Leveringen',
  () => page.getByRole('button', { name: 'Leveringen' }).click(),
  '05-stats-leveringen', 3000);

// 6. Email
await testPage('Email',
  () => page.locator('button:has-text("Email")').click(),
  '06-email', 5000);

// 7. Contacten
await testPage('Contacten',
  () => page.locator('button:has-text("Contacten")').click(),
  '07-contacten', 3000);

// 8. Berichten
await testPage('Berichten',
  () => page.locator('button:has-text("Berichten")').click(),
  '08-berichten', 3000);

// 9. Agenda
await testPage('Agenda',
  () => page.locator('button:has-text("Agenda")').click(),
  '09-agenda', 3000);

// 10. Taken
await testPage('Taken',
  () => page.locator('button:has-text("Taken")').click(),
  '10-taken', 3000);

// 11. Subtaken
await testPage('Subtaken',
  () => page.locator('button:has-text("Subtaken")').click(),
  '11-subtaken', 3000);

// 12. Bestanden
await testPage('Bestanden',
  () => page.locator('button:has-text("Bestanden")').click(),
  '12-bestanden', 3000);

// 13. Projecten
await testPage('Projecten',
  () => page.locator('button:has-text("Projecten")').first().click(),
  '13-projecten', 3000);

// 14. Offertes
await testPage('Offertes',
  () => page.locator('button:has-text("Offertes")').click(),
  '14-offertes', 3000);

// 15. Opdrachtbevestigingen
await testPage('Opdrachtbevestigingen',
  () => page.locator('button:has-text("Opdrachtbevestigingen")').click(),
  '15-opdrachtbevestigingen', 3000);

// 16. Instellingen
await testPage('Instellingen',
  () => page.locator('button:has-text("Instellingen")').click(),
  '16-instellingen', 3000);

// Summary
console.log('\n\n========== SUMMARY ==========');
if (errors.length > 0) {
  console.log(`\nPAGE ERRORS (${errors.length}):`);
  errors.forEach(e => console.log('  ' + e));
} else {
  console.log('\nNo page errors');
}

if (failedRequests.length > 0) {
  console.log(`\nFAILED REQUESTS (${failedRequests.length}):`);
  failedRequests.forEach(r => console.log('  ' + r));
} else {
  console.log('No failed requests');
}

await browser.close();
