const { chromium } = require('playwright');
const fs = require('fs');
const PNG = require('pngjs').PNG;
const pixelmatch = require('pixelmatch');

const expected = PNG.sync.read(fs.readFileSync('expected design.png'));
const { width, height } = expected;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();

  await page.goto('http://localhost:8000');

  await page.screenshot({ path: 'actual.png' });

  const actual = PNG.sync.read(fs.readFileSync('actual.png'));
  const diff = new PNG({ width, height });

  const numDiffPixels = (pixelmatch.default || pixelmatch)(
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

  await browser.close();
})();
