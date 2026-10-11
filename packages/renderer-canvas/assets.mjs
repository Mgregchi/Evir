import { assetBudget, decodeBase64 } from "@evir/project-model";
// Each host owns a resource set. Replacing or disposing it releases bitmaps and
// removes its registered fonts; decoding failure never swaps the current set.
export class SceneAssets {
  constructor() {
    this.values = new Map();
    this.generation = 0;
  }
  async load(project) {
    assetBudget(project.assets);
    const generation = ++this.generation,
      next = new Map();
    const release = (values) => {
      for (const v of values.values()) {
        v.bitmap?.close();
        if (v.font) document.fonts.delete(v.font);
      }
    };
    try {
      for (const asset of project.assets) {
        const bytes = decodeBase64(asset.data);
        if (bytes.length > 16 * 1024 * 1024)
          throw Error("Asset exceeds 16 MiB");
        const hash = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          (v) => v.toString(16).padStart(2, "0"),
        ).join("");
        if (hash !== asset.sha256)
          throw Error("Asset hash mismatch: " + asset.name);
        if (asset.mimeType === "image/png")
          next.set(asset.id, {
            bitmap: await createImageBitmap(
              new Blob([bytes], { type: asset.mimeType }),
            ),
          });
        else if (["font/ttf", "font/otf"].includes(asset.mimeType)) {
          const family = "evir_" + asset.sha256 + "_" + generation;
          const font = await new FontFace(family, bytes).load();
          document.fonts.add(font);
          next.set(asset.id, { font, family });
        }
      }
      if (generation !== this.generation) {
        release(next);
        return false;
      }
      release(this.values);
      this.values = next;
      return true;
    } catch (error) {
      release(next);
      throw error;
    }
  }
  get(id) {
    const v = this.values.get(id);
    if (!v) throw Error("Prepare scene assets before rendering " + id);
    return v;
  }
  dispose() {
    this.generation++;
    for (const v of this.values.values()) {
      v.bitmap?.close();
      if (v.font) document.fonts.delete(v.font);
    }
    this.values.clear();
  }
}
