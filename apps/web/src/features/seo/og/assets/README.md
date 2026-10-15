# Local OG resources

- `signature.svg`: unchanged approved horizontal black signature from
  `isntboxs/altstack-brand@74e2832867ee09e8d375b1e51b9c1ab89f300a66`.
  SHA-256 `25244aa157c8b1bf982064deb7ee1d4b4fe06248e4746e5858919275fcead292`.
- `inter-400.ttf`, `inter-500.ttf`: static roman instances of official
  [InterVariable.ttf](https://github.com/rsms/inter/blob/353b61b9f4430d5f420d56605a6e7993e0941470/docs/font-files/InterVariable.ttf),
  axes `wght=400/500, opsz=32`; fontTools `instantiateVariableFont`.
  SHA-256 respectively `cf8aebb094c26373cc86b55612074788453b175310e9c9e538ff11b317162737`
  and `321ced09ed5b35628b870add1d09b22d26f1b0bdc12ab48bd2a993b3590a7139`.
- `Inter-OFL.txt`: upstream SIL OFL 1.1; retain when redistributing the fonts.
- `glyphs.json`: sorted characters in the static font's `getBestCmap()`.
- `advances.json`: each character's maximum `hmtx` advance across both weights,
  divided by `head.unitsPerEm`, rounded to five decimals. These conservative
  advances make word wrapping deterministic and account for wide characters.

All resources are local. Normal PNG regeneration uses these committed files;
fontTools, GitHub access and font reconstruction are not build/runtime needs.
The server imports TTF as inline data and the signature as SVG text. Do not move
these imports into a client route or public metadata helper.
