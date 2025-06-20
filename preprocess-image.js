const sharp = require('sharp');

const inputPath = 'expected design.png';
const outputPath = 'expected design cleaned.png';

sharp(inputPath)
  .resize({ width: 800 })             // Resize for better readability
  .grayscale()                        // Remove colors for OCR clarity
  .normalize()                        // Increase contrast
  .toFile(outputPath)
  .then(() => {
    console.log(`✅ Preprocessed image saved as '${outputPath}'`);
  })
  .catch(err => {
    console.error('❌ Error preprocessing image:', err);
  });
