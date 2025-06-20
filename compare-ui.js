const fs = require('fs');
const { PNG } = require('pngjs');
const { ssim } = require('ssim.js');

// Load PNG and convert to ImageData-like format
function loadImage(path) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(path)
      .pipe(new PNG())
      .on('parsed', function () {
        resolve({
          data: new Uint8ClampedArray(this.data),
          width: this.width,
          height: this.height
        });
      })
      .on('error', reject);
  });
}

(async () => {
  try {
    console.log('🔍 Loading screenshots...');
    const actual = await loadImage('actual.png');
    const expected = await loadImage('expected design.png');

    if (actual.width !== expected.width || actual.height !== expected.height) {
      console.error('❌ Image dimensions do not match!');
      fs.writeFileSync('ssim-result.json', JSON.stringify({
        status: 'fail',
        reason: 'Dimension mismatch',
        actual: { width: actual.width, height: actual.height },
        expected: { width: expected.width, height: expected.height }
      }, null, 2));
      process.exit(1);
    }

    console.log('🧠 Comparing images using SSIM...');
    const { ssim_map, mssim } = ssim(expected, actual, { ssim: 'fast' });

    const score = mssim;
    const status = score >= 0.95 ? 'pass' : 'fail';

    console.log(`✅ SSIM score: ${score.toFixed(4)} (${status.toUpperCase()})`);

    fs.writeFileSync('ssim-result.json', JSON.stringify({
      status,
      score: score.toFixed(4)
    }, null, 2));

    if (status === 'fail') {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error in SSIM comparison:', err.message);
    fs.writeFileSync('ssim-result.json', JSON.stringify({
      status: 'fail',
      error: err.message
    }, null, 2));
    process.exit(1);
  }
})();
