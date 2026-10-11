export const MAX_ASSET_BYTES = 16 * 1024 * 1024;
export function encodeBase64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 32766)
    out += btoa(String.fromCharCode(...bytes.subarray(i, i + 32766)));
  return out;
}
export function decodeBase64(data) {
  return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
}
export function pngSize(bytes) {
  if (
    bytes.length < 24 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  )
    throw Error("Expected PNG signature and dimensions");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    width = view.getUint32(16),
    height = view.getUint32(20);
  if (!width || !height || width * height > 4 * 1024 * 1024)
    throw Error("PNG exceeds the 4 megapixel asset budget");
  return { width, height };
}
export function assetBudget(assets) {
  if (assets.length > 64) throw Error("Project exceeds 64 assets");
  let total = 0,
    pixels = 0;
  for (const a of assets) {
    const size =
      Math.floor(a.data.length / 4) * 3 -
      (a.data.endsWith("==") ? 2 : a.data.endsWith("=") ? 1 : 0);
    if (size > MAX_ASSET_BYTES) throw Error("Asset exceeds 16 MiB");
    total += size;
    if (a.mimeType === "image/png") {
      const { width, height } = pngSize(decodeBase64(a.data.slice(0, 32)));
      pixels += width * height;
    }
  }
  if (total > 32 * 1024 * 1024 || pixels > 8 * 1024 * 1024)
    throw Error(
      "Project exceeds 32 MiB of asset bytes or 8 megapixels of decoded images",
    );
}
