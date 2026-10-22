// Transfer image bytes as one protocol string instead of one object per byte.
export function encodePixels(bytes) {
  if (!(bytes instanceof Uint8Array || bytes instanceof Uint8ClampedArray))
    throw new TypeError('Pixel transfer requires unsigned 8-bit bytes');
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
