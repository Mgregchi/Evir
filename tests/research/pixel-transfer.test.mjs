import test from 'node:test';
import assert from 'node:assert/strict';
import {encodePixels} from '../../tools/pixel-transfer.mjs';
import {decodePixels} from '../../tools/pixel-transfer.cjs';

test('Pixel transport preserves every byte across empty, chunk-boundary and full-frame inputs', () => {
  for (const Type of [Uint8Array, Uint8ClampedArray])
    for (const length of [0, 1, 8192, 8193, 256 * 256 * 4, 1048576]) {
      const bytes = new Type(length);
      for (let i = 0; i < length; i++) bytes[i] = (i * 73 + 17) % 256;
      assert.deepEqual(Buffer.from(encodePixels(bytes), 'base64'), Buffer.from(bytes));
    }
});

test('Frame decoding rejects truncation and encoding rejects non-byte values', () => {
  assert.throws(() => decodePixels(encodePixels(new Uint8Array(4))), /complete/);
  assert.equal(decodePixels(encodePixels(new Uint8Array(256 * 256 * 4))).length, 262144);
  for (const invalid of [[0, 1], new Float32Array(4), new DataView(new ArrayBuffer(4))])
    assert.throws(() => encodePixels(invalid), TypeError);
});
