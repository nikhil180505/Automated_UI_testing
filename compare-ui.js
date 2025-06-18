const { chromium } = require('playwright');
const fs = require('fs');
const PNG = require('pngjs').PNG;
const pixelmatch = require('pixelmatch');

// Load expected image
const expected = PNG.sync.read(fs.readFileSync('expected design.png'));
const { width, height } = expected;

// Expected element positions (you define these from your design)
const expectedPositions = {
  "Submit": { x: 300, y: 500 },
  "Welcome": { x: 100, y: 100 }
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();

  await page.goto('http://localhost:8000');

  // Screenshot actual page
  await page.screenshot({ path: 'actual.png' });

  // Get actual element positions
  const actualPositions = {
    "Submit": await getPosition(page, 'text=Submit'),
    "Welcome": await getPosition(page, 'text=Welcome')
  };

  await browser.close();

  // Visual diff
  const actual = PNG.sync.read(fs.readFileSync('actual.png'));
  const diff = new PNG({ width, height });

  const numDiffPixels = (pixelmatch.default || pixelmatch)(
    expected.data, actual.data, diff.data, width, height, { threshold: 0.1 }
  );

  fs.writeFileSync('diff.png', PNG.sync.write(diff));
  fs.writeFileSync('pixel-diff.txt', numDiffPixels.toString());

  // Build layout issues
  const issues = [];
  for (const key in expectedPositions) {
    const actual = actualPositions[key];
    const expected = expectedPositions[key];

    if (Math.abs(actual.x - expected.x) > 10)
      issues.push(`${key} is ${actual.x - expected.x}px horizontally off`);
    if (Math.abs(actual.y - expected.y) > 10)
      issues.push(`${key} is ${actual.y - expected.y}px vertically off`);
  }

  // Save issues
  fs.writeFileSync('ui-issues.json', JSON.stringify({
    status: numDiffPixels > 100 ? "fail" : "pass",
    pixels: numDiffPixels,
    issues
  }, null, 2));

  console.log(`🧪 Pixel difference: ${numDiffPixels}`);
})();

async function getPosition(page, selector) {
  const box = await page.locator(selector).boundingBox();
  return { x: Math.round(box?.x || 0), y: Math.round(box?.y || 0) };
}
