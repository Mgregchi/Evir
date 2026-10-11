import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createStaticServer } from "../../tools/static-server.mjs";

const meta = (html) =>
  Object.fromEntries(
    [
      ...html.matchAll(
        /<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"/g,
      ),
    ].map((m) => [m[1], m[2]]),
  );
const agents = [
  "Twitterbot/1.0",
  "facebookexternalhit/1.1",
  "WhatsApp/2.24",
  "LinkedInBot/1.0",
];
const jpegSize = (bytes) => {
  assert.equal(bytes.readUInt16BE(0), 0xffd8);
  for (let pos = 2; pos < bytes.length; ) {
    assert.equal(bytes[pos++], 0xff);
    while (bytes[pos] === 0xff) pos++;
    const marker = bytes[pos++],
      size = bytes.readUInt16BE(pos);
    if ([0xc0, 0xc1, 0xc2].includes(marker))
      return {
        width: bytes.readUInt16BE(pos + 5),
        height: bytes.readUInt16BE(pos + 3),
      };
    pos += size;
  }
  assert.fail("No JPEG frame dimensions");
};

for (const [name, siteUrl, origin, base] of [
  ["default", "", "https://evir.idey.click", ""],
  ["override", "https://other.example/Evir/", "https://other.example", "/Evir"],
])
  test(`raw crawler HTML includes a working image in ${name} builds without JavaScript`, async () => {
    const output = `apps/web/.test-build/social-${name}`;
    execFileSync(process.execPath, ["apps/web/build.mjs"], {
      env: {
        ...process.env,
        SITE_URL: siteUrl,
        PUBLIC_SITE_URL: "",
        PUBLIC_BASE_PATH: "",
        EVIR_WEB_OUTPUT: output,
      },
      stdio: "pipe",
    });
    const info = JSON.parse(
      await fs.readFile(path.join(output, "build-info.json"), "utf8"),
    );
    const server = createStaticServer(path.resolve(output), base);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const local = `http://127.0.0.1:${server.address().port}`;
    try {
      for (const page of info.pages)
        for (const agent of agents) {
          const response = await fetch(`${local}${base}/${page}`, {
            headers: { "User-Agent": agent },
          });
          assert.equal(response.status, 200);
          assert(response.headers.get("content-type").startsWith("text/html"));
          const html = await response.text(),
            tags = meta(html),
            url = origin + base + "/" + page,
            image = origin + base + "/assets/evir-showcase.jpg";
          assert.equal(tags["og:url"], url);
          assert.equal(tags["og:image"], image);
          assert.equal(tags["twitter:image"], image);
          assert.equal(tags["twitter:card"], "summary_large_image");
          assert.equal(tags["og:image:type"], "image/jpeg");
          assert.equal(tags["og:image:width"], "1200");
          assert.equal(tags["og:image:height"], "630");
          assert(tags["og:image:alt"]);
          assert.equal(tags["twitter:title"], tags["og:title"]);
          assert.equal(tags["twitter:description"], tags["og:description"]);
          assert(html.includes(`<link rel="canonical" href="${url}">`));
        }
      const homepage = meta(await (await fetch(`${local}${base}/`)).text());
      const image = await fetch(local + new URL(homepage["og:image"]).pathname);
      assert.equal(image.status, 200);
      assert.equal(image.headers.get("content-type"), "image/jpeg");
      assert.deepEqual(jpegSize(Buffer.from(await image.arrayBuffer())), {
        width: 1200,
        height: 630,
      });
      assert(
        (await (await fetch(local + base + "/robots.txt")).text()).includes(
          `Sitemap: ${origin}${base}/sitemap.xml`,
        ),
      );
      assert(
        (await (await fetch(local + base + "/sitemap.xml")).text()).includes(
          `<loc>${origin}${base}/editor/</loc>`,
        ),
      );
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
