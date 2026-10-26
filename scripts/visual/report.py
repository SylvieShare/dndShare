"""Strict evidence validation and side-by-side HTML; no automatic visual approval."""
import hashlib
import html
import json
from pathlib import Path
import struct
import zlib

from exceptions import read_exceptions

MATRIX = json.loads((Path(__file__).with_name("matrix.json")).read_text())
LABELS = {"collections": "Обзор коллекций", "menu": "Открытое меню", "list": "Список коллекции", "record": "Карточка записи"}


def png_dimensions(data):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("Invalid screenshot PNG")
    offset, dimensions, compressed, ended = 8, None, bytearray(), False
    while offset + 12 <= len(data):
        size = struct.unpack(">I", data[offset:offset + 4])[0]
        kind, payload = data[offset + 4:offset + 8], data[offset + 8:offset + 8 + size]
        crc = data[offset + 8 + size:offset + 12 + size]
        if len(crc) != 4 or zlib.crc32(kind + payload) != struct.unpack(">I", crc)[0]:
            raise ValueError("Corrupt or truncated PNG chunk")
        if kind == b"IHDR":
            dimensions = struct.unpack(">II", payload[:8])
        if kind == b"IDAT":
            compressed.extend(payload)
        if kind == b"IEND":
            ended = True
            break
        offset += size + 12
    if not ended or dimensions is None or not compressed:
        raise ValueError("Incomplete screenshot PNG")
    decompressor = zlib.decompressobj()
    decompressor.decompress(compressed)
    if not decompressor.eof:
        raise ValueError("Truncated screenshot pixels")
    return dimensions


def validate_entries(output, entries, fixture):
    expected = {(platform, format_["name"], state): format_ for platform in MATRIX["platforms"]
                for format_ in MATRIX["formats"] for state in MATRIX["states"]}
    observed, files = set(), set()
    for entry in entries:
        key = (entry["platform"], entry["format"], entry["state"])
        if key not in expected or key in observed:
            raise ValueError(f"Unexpected or duplicate screenshot: {key}")
        observed.add(key)
        format_ = expected[key]
        relative = Path(entry["file"])
        if relative.as_posix() != f"{key[0]}/{key[1]}-{key[2]}.png":
            raise ValueError("Screenshot filename does not match its scenario")
        if relative.is_absolute() or ".." in relative.parts or relative.as_posix() in files:
            raise ValueError("Screenshot path must be unique and inside the output directory")
        files.add(relative.as_posix())
        path = (output / relative).resolve()
        if not path.is_relative_to(output.resolve()):
            raise ValueError("Screenshot symlink escapes output directory")
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != entry["sha256"]:
            raise ValueError(f"Screenshot hash mismatch: {relative}")
        wanted = (format_["width"], format_["height"])
        if png_dimensions(data) != wanted:
            raise ValueError(f"Screenshot dimensions mismatch: {relative}")
        for field in ("viewport", "dimensions"):
            if (entry[field]["width"], entry[field]["height"]) != wanted:
                raise ValueError(f"Incorrect measured {field}: {relative}")
        if entry["recordID"] != (fixture["recordID"] if key[2] == "record" else None):
            raise ValueError(f"Wrong scenario record: {relative}")
        if key[0] == "android" and ("insetsDp" not in entry or "contentDp" not in entry):
            raise ValueError("Native screenshot requires measured insets and content dp")
    if observed != set(expected):
        raise ValueError(f"Incomplete screenshot matrix; missing: {sorted(set(expected) - observed)}")
    actual = {path.relative_to(output).as_posix() for platform in MATRIX["platforms"]
              for path in (output / platform).glob("*.png")}
    if actual != files:
        raise ValueError("Screenshot files and manifest entries do not match")


def render_html(manifest):
    escape = lambda value: html.escape(str(value), quote=True)
    sections = []
    for format_ in MATRIX["formats"]:
        for state in MATRIX["states"]:
            figures = []
            for platform in MATRIX["platforms"]:
                entry = next(entry for entry in manifest["screenshots"] if
                             (entry["platform"], entry["format"], entry["state"]) == (platform, format_["name"], state))
                viewport = entry["viewport"]
                native = ""
                if platform == "android":
                    native = f" · insets dp: {escape(json.dumps(entry['insetsDp']))} · content dp: {escape(json.dumps(entry['contentDp']))}"
                figures.append(f'<figure><figcaption>{platform.upper()} — {viewport["width"]}×{viewport["height"]} '
                               f'{escape(viewport["unit"])}{native}</figcaption><a href="{escape(entry["file"])}">'
                               f'<img src="{escape(entry["file"])}" alt="{escape(LABELS[state])} {platform}" loading="lazy"></a></figure>')
            sections.append(f'<section><h2>{escape(format_["name"])} · {escape(LABELS[state])}</h2><div class="pair">'
                            + "".join(figures) + '</div></section>')
    exceptions = escape(json.dumps(manifest["approvedExceptions"], ensure_ascii=False, indent=2))
    return f'''<!doctype html><html lang="ru"><meta charset="utf-8"><title>WEB / ANDROID UI review</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{{margin:24px;background:#111820;color:#e5e8ed;font:15px system-ui}}a{{color:#a9caff}}
.pair{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}figure{{margin:0;min-width:0}}
img{{display:block;width:100%;height:auto;border:1px solid #415167}}figcaption{{min-height:60px;overflow-wrap:anywhere}}
section{{margin:32px 0}}pre{{white-space:pre-wrap;overflow-wrap:anywhere}}code{{overflow-wrap:anywhere}}</style>
<h1>WEB / ANDROID — визуальное сравнение</h1>
<p>Комплектность: {len(manifest["screenshots"])}/{len(MATRIX["formats"]) * len(MATRIX["states"]) * len(MATRIX["platforms"])}. Требуется ручная визуальная проверка. Отчёт не устанавливает пиксельную идентичность
и не означает согласование дизайна. Изображения целиком, включая системные панели Android; нажмите для исходного PNG.</p>
<p>Редакция: {escape(manifest['edition'])} · recordID: {manifest['recordID']} · изолированный API/PostgreSQL.</p>
<p>Source SHA: <code>{escape(manifest['sourceSHA'])}</code><br>Source hash: <code>{escape(manifest['sourceHash'])}</code>
<br>Fixture hash: <code>{escape(manifest['dataFixtureHash'])}</code> · <a href="manifest.json">manifest.json</a></p>
<h2>Approved exceptions из предоставленного JSON</h2>
<p>Автор, дата и reference приведены из реестра. Отчёт проверяет структуру записи,
но не верифицирует источник человеческого согласования и никогда не одобряет исключения автоматически.</p>
<pre>{exceptions}</pre>
{''.join(sections)}</html>'''


def write_report(output):
    output = Path(output)
    read = lambda name: json.loads((output / name).read_text(encoding="utf-8"))
    fixture, identity = read("fixture.json"), read("source.json")
    exceptions = read_exceptions(output / "exceptions.json")
    evidence, capture = read("api-evidence.json"), read("capture.json")
    if not evidence["restAndNativeMatch"] or not all(capture.values()):
        raise ValueError("Missing shared isolated API evidence")
    if read("android/device-before.json") != read("android/device-after.json"):
        raise ValueError("Emulator configuration was not restored")
    entries = read("android.json")
    for format_ in MATRIX["formats"]:
        entries.extend(read(f"web-{format_['name']}.json"))
    validate_entries(output, entries, fixture)
    for entry in entries:
        entry.update(identity, edition=fixture["edition"], dataFixtureHash=fixture["dataFixtureHash"])
    manifest = {"schemaVersion": 1, **identity, "dataFixtureHash": fixture["dataFixtureHash"],
                "edition": fixture["edition"], "recordID": fixture["recordID"], "matrix": MATRIX,
                "captureComplete": True, "visualApproval": "requires-human-review",
                "approvedExceptions": exceptions["exceptions"], "apiEvidence": evidence,
                "exceptionsSHA256": hashlib.sha256((output / "exceptions.json").read_bytes()).hexdigest(),
                "emulatorConfigurationRestored": True,
                "screenshots": entries}
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (output / "index.html").write_text(render_html(manifest), encoding="utf-8")
