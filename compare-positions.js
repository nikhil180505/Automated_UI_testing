const fs = require('fs');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const Tesseract = require('tesseract.js');

const expectedImagePath = 'expected design.png';

function parseOCRResults(ocrData) {
  const elements = [];
  ocrData.data.words.forEach((word) => {
    const { text, bbox } = word;
    if (text.trim().length > 0) {
      elements.push({
        text: text.trim(),
        expectedX: bbox.x0,
        expectedY: bbox.y0
      });
    }
  });
  return elements;
}

async function getPosition(page, text, expectedX, expectedY) {
  try {
    const locator = page.getByText(text, { exact: true });
    await locator.waitFor({ timeout: 3000 });

    const box = await locator.boundingBox();

    if (box) {
      const deltaX = Math.abs(box.x - expectedX);
      const deltaY = Math.abs(box.y - expectedY);

      return {
        status: 'found',
        expected: { x: expectedX, y: expectedY },
        actual: { x: box.x, y: box.y },
        delta: { x: deltaX, y: deltaY }
      };
    } else {
      return { status: 'no bounding box' };
    }
  } catch (err) {
    return { status: 'not found' };
  }
}

(async () => {
  // 🧠 Run OCR on the expected image
  console.log('🧠 Running OCR on expected design image...');
  const ocrData = await Tesseract.recognize(expectedImagePath, 'eng', {
    logger: (m) => process.stdout.write('.')
  });
  console.log('\n✅ OCR complete');

  const elementData = parseOCRResults(ocrData);
  console.log(`🧾 Found ${elementData.length} elements in expected image`);

  // 🎭 Launch Playwright and get actual layout
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000');

  const results = [];

  for (const { text, expectedX, expectedY } of elementData) {
    const result = await getPosition(page, text, expectedX, expectedY);

    if (result.status === 'found') {
      console.log(
        `🔍 '${text}' is off by X: ${result.delta.x.toFixed(1)}px, Y: ${result.delta.y.toFixed(1)}px`
      );
    } else if (result.status === 'no bounding box') {
      console.warn(`⚠️ Element with text "${text}" found but has no bounding box`);
    } else {
      console.warn(`❌ Element '${text}' not found`);
    }

    results.push({ text, ...result });
  }

  await browser.close();

  // 💾 Save results
  fs.writeFileSync('ui-issues.json', JSON.stringify(results, null, 2));
  console.log('📄 Layout comparison saved to ui-issues.json');
})();
