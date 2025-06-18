const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');
const Jimp = require('jimp');
const { chromium } = require('playwright');

(async () => {
  const imagePath = path.join(__dirname, 'expected-design.png');
  const image = await Jimp.read(imagePath);

  // Preprocess to improve OCR accuracy
  image.grayscale().contrast(0.5);

  const worker = await createWorker('eng');
  const {
    data: { words }
  } = await worker.recognize(await image.getBufferAsync(Jimp.MIME_PNG));

  console.log(`🧠 Found ${words.length} elements in image:`);

  const elementData = words.map(word => ({
    text: word.text,
    x: word.bbox.x0,
    y: word.bbox.y0,
    width: word.bbox.x1 - word.bbox.x0,
    height: word.bbox.y1 - word.bbox.y0
  }));

  await worker.terminate();

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:8000');
  await page.waitForLoadState('networkidle');

  for (const { text, x, y } of elementData) {
    try {
      const locator = page.getByText(text, { exact: true });
      const box = await locator.boundingBox();
      if (box) {
        const deltaX = Math.abs(box.x - x);
        const deltaY = Math.abs(box.y - y);

        console.log(`🔍 '${text}' is off by X:${deltaX.toFixed(1)}px Y:${deltaY.toFixed(1)}px`);
      } else {
        console.warn(`⚠️ Element with text "${text}" not found on the page.`);
      }
    } catch (err) {
      console.error(`❌ Error locating "${text}":`, err.message);
    }
  }

  await browser.close();
})();
