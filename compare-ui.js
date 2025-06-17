const { chromium } = require('playwright');
const fs = require('fs');
const PNG = require('pngjs').PNG;
const pixelmatch = require('pixelmatch');

// Handle pixelmatch export differences
const actualPixelMatch = pixelmatch.default || pixelmatch;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:8000');
  await page.screenshot({ path: 'actual.png', fullPage: true });
  await browser.close();

  const expected = PNG.sync.read(fs.readFileSync('expected design.png'));
  const actual = PNG.sync.read(fs.readFileSync('actual.png'));
  const { width, height } = expected;

  const diff = new PNG({ width, height });

  const numDiffPixels = actualPixelMatch(
    expected.data,
    actual.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  );

  fs.writeFileSync('diff.png', PNG.sync.write(diff));
  fs.writeFileSync('pixel-diff.txt', numDiffPixels.toString());

  console.log(`🧪 Pixel difference: ${numDiffPixels}`);
})();
