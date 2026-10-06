const { PNG } = require("pngjs");
exports.capture = async (page) => {
  if ((process.env.RIVE_RENDERER || "canvas") === "canvas")
    return page.evaluate(() => pixels());
  const img = PNG.sync.read(
    await page.locator("#canvas").screenshot({ omitBackground: true }),
  );
  const data = img.data;
  let n = 0,
    x = 0,
    y = 0,
    hash = 2166136261;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]) {
      n++;
      x += (i / 4) % img.width;
      y += Math.floor(i / 4 / img.width);
    }
    for (let j = 0; j < 4; j++) hash = Math.imul(hash ^ data[i + j], 16777619);
  }
  return { count: n, cx: x / n, cy: y / n, hash: hash >>> 0 };
};
