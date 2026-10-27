# Offline display and prose fonts

These WOFF2 files are lossless conversions of the official Google Fonts TTFs
already shipped with Android in `native/androidApp/src/main/res/font/`.
`native/androidApp/font-sources.json` is the authority for source URLs and
SHA-256. The two `*-OFL.txt` files are byte-for-byte copies of Android's licenses.
`manifest.json` records source/output hashes, licenses, CSS, generator and lock.
Each WOFF2 filename contains the first 12 hexadecimal digits of its output
SHA-256, for example `literata-230e5b1de4f4.woff2`. CSS and the manifest reference
that filename, so a conversion producing different bytes gets a new URL even
when the source TTF is unchanged. This supports the one-year immutable cache
for `/static/`. Generation removes obsolete hashed and unhashed generated WOFF2
files; verification rejects stale files. The OFL filenames stay unchanged.

Import `@/app/fonts.css` once from `frontend/src/main.js` alongside the existing
theme imports. The CSS declares the existing `Cormorant Garamond` display family
(500–700, including 600) and `Literata` prose family (400–700, normal and italic),
with `font-display: swap`. It uses only local `/static/fonts/` URLs, without
`local()` resolution to machine-installed fonts. Existing font stacks, metrics,
optical sizing and the dark theme are unchanged. Screenshot capture should await
`document.fonts.ready` after displaying the content.

No glyphs, hinting or axes are removed. The complete original axes remain:

| Font | Weight axis | Optical size axis |
| --- | --- | --- |
| Cormorant Garamond | 300–700 | — |
| Literata normal/italic | 200–900 | 7–72 |

From the repository root, verification needs only Python's standard library:

```sh
python3 scripts/design/fonts.py --check
python3 -m unittest discover -s scripts/design -p 'test_fonts.py'
```

Regeneration uses Python 3.11+ and only the hash-locked generation dependencies
FontTools 4.67.0 and Brotli 1.2.1. Their published wheels were verified against
official PyPI metadata: [FontTools](https://pypi.org/project/fonttools/4.67.0/),
[Brotli](https://pypi.org/project/brotli/1.2.1/). No npm dependencies are required.
Use an isolated environment inside the ignored `build/` directory on C:

```sh
python3 -m venv build/dev-tools/fonts
build/dev-tools/fonts/bin/python -m pip install --require-hashes -r scripts/design/requirements-fonts.lock
build/dev-tools/fonts/bin/python scripts/design/fonts.py --generate
build/dev-tools/fonts/bin/python -m unittest discover -s scripts/design -p 'test_fonts.py'
```

For Windows Python use `py -3 -m venv build/dev-tools/fonts` and replace
`bin/python` with `Scripts/python.exe`. WSL needs the Python `venv`/`ensurepip`
support for the first two setup commands. Generation decodes every output and
compares every cmap, glyph outline/order, advance width, variable axis and all
unchanged layout/variation/metric tables with the source TTF. Repeating the
command with the same sources and lock produces identical font and manifest
bytes. Updating Android's fonts, provenance, licenses, CSS, generator or lock
requires regeneration before `--check` passes again.
