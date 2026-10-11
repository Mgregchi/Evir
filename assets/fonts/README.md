# Bundled default font

`NotoSans-latin.ttf` is an ASCII U+0020–U+007E subset of Noto Sans's variable TTF, used by the original Caption study and Studio's default editable text. It retains the upstream OFL license; see `OFL-NotoSans.txt`. It is not Evir brand artwork.

Source retrieved 11 October 2026:

- https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/NotoSans%5Bwdth,wght%5D.ttf
- Original SHA-256: `bfb7bb691513f12e734dc346c03a03f784912432d7e3fa8e56efcf906fe86b3d`
- License: https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/OFL.txt

Generation used Python fontTools' subset API (`Subsetter.populate(unicodes=range(32,127))`, `subset(font)`, `save_font`). The checked-in subset is the reproducible input to normal application/example builds; those builds do not download or subset fonts. The fontTools tooling is only needed to replace the subset deliberately, after reviewing its provenance and updating the hash below.

Subset SHA-256: `4a9e915dd8b2d0122ecf3d4013afd7d6826b551f368b0f01cc1b45a3a4b63def`.
