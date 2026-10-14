# Public showcase provenance

`milo-poster.png`, `orbit-poster.png`, `bloom-poster.png`, `tempo-poster.png` `signal-poster.png`, `gather-poster.png` and `wisp-poster.png` are browser captures of independently authored Evir projects in `examples/`. Their editable source uses Studio's project schema; their `.riv` files are built by Evir's existing subset compiler. No artwork from the supplied third-party Rive files is used here.

`studio-overview.png`, `studio-paths.png`, `studio-animation.png` and `studio-interact.png` are real 1440×900 screenshots captured from Evir Studio with the Milo project open. They are not interface mockups. Reproduce with `npm run web:assets` in the repository environment.

Both builds copy the existing Evir wordmark and favicon unchanged from `assets/brand/`. See [brand provenance](../../../assets/brand/README.md); no logo recoloring, replacement letterforms or remix is added by this site.

Example artwork and website source are original project contributions. Existing brand provenance is separate from the code's MIT license. Uploaded research files remain outside the public distribution.

`evir-showcase.jpg` is an AI-generated story illustration, not an editor screenshot. It references the independently authored Milo poster: Bézier outlines → motion → an interactive hello. The original Evir wordmark/icon were not supplied to generation or altered. The original generated 1730×909 artwork was proportionally resized and center-cropped to 1200×630 JPEG (84,258 bytes); SHA-256 `d0d91f066db9cc869ad7815701245dcfff7dc4ec083709d936f825bff9393cab`. It is the Open Graph/Twitter image on every public page, using the default Evir address or a `SITE_URL` override. Actual Studio screenshots remain separately labeled.

[Gallery research and acceptance](../../../docs/23-growing-showcase-gallery.md) records each study’s supported features. Posters are actual Canvas renders; each study includes editable source and an Evir-compiled `.riv`.

Wisp’s organic outlines are generated sampled loops fitted with Studio’s freehand algorithm, not captured human handwriting. Its poster is a real Canvas render; all point IDs in its source/export are deterministic.

`measure-poster.png` is a real Canvas capture of the original Measure composition in `examples/measure.evir-project`. `measure.riv` is its Evir-compiled native export. `measure.guides.json` is a separate Studio guide preset; guides are excluded from scene/native exports. The three cards and Balance loop contain no supplied third-party artwork.

`sprig-poster.png` is a real Canvas capture of the original Sprig plant. `sprig.evir-project` / `.riv` contain the completed six-point leaf and Breeze loop; `sprig-start.evir-project` / `.riv` retain its three-point open seed. `sprig.continuation.json` is a readable numeric point recipe, not an importer or runtime feature. All artwork is original project work; no uploaded research scene is redistributed.
