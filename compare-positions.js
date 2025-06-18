const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');
const Jimp = require('jimp');
const { chromium } = require('playwright');

(async () => {
  const imagePath = path.join(__dirname, 'expected-design.png');
  const image = await Jimp.read(imagePath);

  // Preprocess image to improve OCR accuracy
  image.grayscale().contrast(0.5);

  const worker = await createWorker('eng');
  const {
    data: { words }
  } = await worker.recognize(await image.getBufferAsync(Jimp.MIME_PNG));

  console.log(`🧠 Found ${words.length} text elements in image`);

  const elementData = words.map(word => ({
    text: word.text,
    expectedX: word.bbox.x0,
    expectedY: word.bbox.y0,
    width: word.bbox.x1 - word.bbox.x0,
    height: word.bbox.y1 - word.bbox.y0
  }));

  await worker.terminate();

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:8000');
  await page.waitForLoadState('networkidle');

  const results = [];

  for (const { text, expectedX, expectedY } of elementData) {
    try {
      const locator = page.getByText(text, { exact: true });
      await locator.waitFor({ timeout: 3000 });

      const box = await locator.boundingBox();

      if (box) {
        const deltaX = Math.abs(box.x - expectedX);
        const deltaY = Math.abs(box.y - expectedY);

        const summary = `🔍 '${text}' is off by X: ${deltaX.toFixed(1)}px, Y: ${deltaY.toFixed(1)}px`;
        console.log(summary);

        results.push({
          text,
          status: 'found',
          expected: { x: expectedX, y: expectedY },
          actual: { x: box.x, y: box.y },
          delta: { x: deltaX, y: deltaY }
        });
      } else {
        const msg = `⚠️ Element with text "${text}" found but has no bounding box`;
        console.warn(msg);
        results.push({ text, status: 'no bounding box' });
      }
    } catch (err) {
      console.warn(`❌ Element '${text}' not found`);
      results.push({ text, status: 'not found' });
    }
  }

  await browser.close();

  fs.writeFileSync('ui-issues.json', JSON.stringify(results, null, 2));
  console.log(`✅ Results saved to ui-issues.json`);
})();
