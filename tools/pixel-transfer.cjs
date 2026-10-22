const assert = require('node:assert/strict');

exports.decodePixels = encoded => {
  const bytes = Buffer.from(encoded, 'base64');
  assert.equal(bytes.length, 256 * 256 * 4, 'one complete 256×256 RGBA frame');
  return bytes;
};

exports.readCanvasPixels = async page => exports.decodePixels(
  await page.evaluate(async () => {
    const {encodePixels} = await import('/tools/pixel-transfer.mjs');
    return encodePixels(document.querySelector('#canvas')
      .getContext('2d').getImageData(0, 0, 256, 256).data);
  }),
);
