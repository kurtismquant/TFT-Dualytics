// Reusable screenshot helper for visual iteration on the frontend.
// Usage: node scripts/screenshot.mjs <url> <outFile> [viewportWidth] [viewportHeight]
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5174/';
const outFile = process.argv[3] || 'scripts/shots/landing.png';
const width = Number(process.argv[4]) || 1440;
const height = Number(process.argv[5]) || 900;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
// Give animations / lazy content a moment to settle.
await page.waitForTimeout(1500);
await page.screenshot({ path: outFile, fullPage: true });
await browser.close();
console.log(`Saved ${outFile}`);
