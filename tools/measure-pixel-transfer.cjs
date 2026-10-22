const assert = require('node:assert/strict');
const fs = require('node:fs');
const {createHash} = require('node:crypto');
const {run} = require('./browser.cjs');
const {decodePixels} = require('./pixel-transfer.cjs');

(async () => {
  const expected = Buffer.alloc(256 * 256 * 4);
  for (let i = 0; i < expected.length; i++) expected[i] = (i * 73 + 17) % 256;
  const results = [];
  let browserVersion;
  await run(async (page, browser) => {
    browserVersion = browser.version();
    await page.evaluate(async () => {
      window.transferEncoder = (await import('/tools/pixel-transfer.mjs')).encodePixels;
      window.transferBytes = new Uint8ClampedArray(256 * 256 * 4);
      for (let i = 0; i < transferBytes.length; i++) transferBytes[i] = (i * 73 + 17) % 256;
    });
    for (const method of ['number-array', 'base64-bytes']) {
      const start = performance.now(), before = process.cpuUsage();
      const value = await page.evaluate(method => method === 'number-array'
        ? Array.from(transferBytes) : transferEncoder(transferBytes), method);
      const bytes = method === 'number-array' ? Buffer.from(value) : decodePixels(value);
      const cpu = process.cpuUsage(before);
      assert.deepEqual(bytes, expected, 'every transferred byte matches the independent pattern');
      results.push({method, wallMs:performance.now() - start, nodeCpuMs:(cpu.user + cpu.system) / 1000, bytes:bytes.length, exact:true});
    }
  });
  const out = 'research/results/software-closure/pixel-transfer';
  fs.mkdirSync(out, {recursive:true});
  fs.writeFileSync(`${out}/browser.json`, JSON.stringify({
    checkedAt:new Date().toISOString(), browser:browserVersion,
    scope:'One local cloud-browser sample per method, with the encoder module primed. Measures validation transport only; no renderer, GPU or physical-device performance claim.',
    sourceSha256:createHash('sha256').update(fs.readFileSync('tools/pixel-transfer.mjs')).digest('hex'), results,
  }, null, 2) + '\n');
  console.log('Both pixel transfer methods preserved all 262,144 bytes.', results);
})().catch(error => { console.error(error); process.exitCode = 1; });
