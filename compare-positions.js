const fs = require('fs');
const { chromium } = require('playwright');
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

    const count = await locator.count();
    if (count === 0) {
      return {
        text,
        status: 'not found',
        expected: { x: expectedX, y: expectedY },
        actual: null,
        delta: null
      };
    }

    const isVisible = await locator.first().isVisible();
    if (!isVisible) {
      return {
        text,
        status: 'not visible',
        expected: { x: expectedX, y: expectedY },
        actual: null,
        delta: null
      };
    }

    const box = await locator.first().boundingBox();
    if (!box) {
      return {
        text,
        status: 'no bounding box',
        expected: { x: expectedX, y: expectedY },
        actual: null,
        delta: null
      };
    }

    const deltaX = Math.round(box.x - expectedX);
    const deltaY = Math.round(box.y - expectedY);

    return {
      text,
      status: 'found',
      expected: { x: expectedX, y: expectedY },
      actual: { x: Math.round(box.x), y: Math.round(box.y) },
      delta: { x: deltaX, y: deltaY }
    };
  } catch (err) {
    return {
      text,
      status: 'error',
      expected: { x: expectedX, y: expectedY },
      actual: null,
      delta: null,
      error: err.message
    };
  }
}

(async () => {
  console.log('🧠 Running OCR on expected design image...');
  const ocrData = await Tesseract.recognize(expectedImagePath, 'eng', {
    logger: (m) => process.stdout.write('.')
  });
  console.log('\n✅ OCR complete');

  const elementData = parseOCRResults(ocrData);
  console.log(`🧾 Found ${elementData.length} elements in expected image`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000');

  const results = [];

  for (const { text, expectedX, expectedY } of elementData) {
    const result = await getPosition(page, text, expectedX, expectedY);

    if (result.status === 'found') {
      console.log(`✅ '${text}' is off by X: ${result.delta.x}px, Y: ${result.delta.y}px`);
    } else {
      console.warn(`❌ '${text}' → ${result.status}`);
    }

    results.push(result);
  }

  await browser.close();

  const issues = results
    .filter((r) => r.status !== 'found')
    .map((r) => `❌ '${r.text}' → ${r.status}`);

  // Save final JSON
  fs.writeFileSync(
    'ui-issues.json',
    JSON.stringify(
      {
        status: issues.length === 0 ? 'pass' : 'fail',
        issues,
        results
      },
      null,
      2
    )
  );

  console.log('📄 Layout comparison saved to ui-issues.json');
})();
