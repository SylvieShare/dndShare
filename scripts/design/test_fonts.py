"""Verifier regressions run with stdlib; generation checks decode the real fonts."""

import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

import fonts


class FontManifestTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='dndshare-font-check-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        saved = json.loads((fonts.ROOT / fonts.MANIFEST).read_text('utf-8'))
        self.faces = saved['fonts']
        self.outputs = {Path(face['source']['file']).name: Path(face['output']['file'])
                        for face in self.faces}
        records = [saved['generator']['script'], saved['generator']['requirements'],
                   saved['source_manifest'], saved['css']]
        for face in saved['fonts']:
            records.extend([face['source'], face['output']])
        for license_record in saved['licenses']:
            records.extend(license_record.values())
        for relative in {record['file'] for record in records} | {str(fonts.MANIFEST)}:
            destination = self.root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(fonts.ROOT / relative, destination)

    def mutate(self, relative):
        path = self.root / relative
        path.write_bytes(path.read_bytes() + b'\nmodified')

    def edit_json(self, relative, edit):
        path = self.root / relative
        data = json.loads(path.read_text('utf-8'))
        edit(data)
        path.write_text(json.dumps(data), encoding='utf-8')

    def test_check_runs_without_site_packages_from_another_working_directory(self):
        result = subprocess.run(
            [sys.executable, '-S', str(self.root / fonts.SCRIPT), '--check'],
            cwd=self.root.parent, capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('Offline web fonts verified', result.stdout)
        css = (self.root / fonts.CSS).read_text('utf-8')
        for face in self.faces:
            source = Path(face['source']['file'])
            output = Path(face['output']['file'])
            digest = hashlib.sha256((self.root / output).read_bytes()).hexdigest()
            self.assertEqual(output.name, f"{source.stem.replace('_', '-')}-{digest[:12]}.woff2")
            self.assertNotEqual(digest[:12], face['source']['sha256'][:12])
            self.assertIn(f'/static/fonts/{output.name}', css)

    def test_tampered_output(self):
        relative = self.outputs['literata.ttf']
        self.mutate(relative)
        with self.assertRaisesRegex(ValueError, 'stale or modified'):
            fonts.check(self.root)
        # A recipe producing new bytes cannot keep the previous immutable URL,
        # even if the manifest's output SHA is updated and the TTF is unchanged.
        digest = hashlib.sha256((self.root / relative).read_bytes()).hexdigest()
        self.edit_json(fonts.MANIFEST,
                       lambda data: data['fonts'][1]['output'].update(sha256=digest))
        with self.assertRaises(FileNotFoundError):
            fonts.check(self.root)

    def test_missing_output_and_stale_generated_names(self):
        relative = self.outputs['literata_italic.ttf']
        (self.root / relative).unlink()
        with self.assertRaises(FileNotFoundError):
            fonts.check(self.root)
        shutil.copyfile(fonts.ROOT / relative, self.root / relative)
        for old_name in ('literata.woff2', 'literata-000000000000.woff2'):
            with self.subTest(old_name=old_name):
                old = self.root / fonts.PUBLIC / old_name
                shutil.copyfile(self.root / self.outputs['literata.ttf'], old)
                with self.assertRaisesRegex(ValueError, 'Stale WOFF2 files'):
                    fonts.check(self.root)
                old.unlink()

    def test_source_changed_without_updating_android_manifest(self):
        self.mutate(fonts.NATIVE / 'src/main/res/font/literata.ttf')
        with self.assertRaisesRegex(ValueError, 'Source SHA-256'):
            fonts.check(self.root)

    def test_endorsed_android_update_still_requires_web_regeneration(self):
        source = fonts.NATIVE / 'src/main/res/font/literata.ttf'
        self.mutate(source)
        digest = fonts.record(self.root, source)['sha256']
        self.edit_json(fonts.NATIVE / 'font-sources.json',
                       lambda entries: entries[1].update(sha256=digest))
        with self.assertRaisesRegex(ValueError, 'stale or modified'):
            fonts.check(self.root)

    def test_source_provenance_changed(self):
        self.edit_json(fonts.NATIVE / 'font-sources.json',
                       lambda entries: entries[0].update(source='https://example.invalid/replaced.ttf'))
        with self.assertRaisesRegex(ValueError, 'stale or modified'):
            fonts.check(self.root)

    def test_duplicate_android_sources(self):
        self.edit_json(fonts.NATIVE / 'font-sources.json', lambda entries: entries.append(entries[0]))
        with self.assertRaisesRegex(ValueError, 'must match'):
            fonts.check(self.root)

    def test_public_license_must_match_android_bytes(self):
        self.mutate(fonts.PUBLIC / 'literata-OFL.txt')
        with self.assertRaisesRegex(ValueError, 'Public OFL differs'):
            fonts.check(self.root)

    def test_tampered_manifest_metadata(self):
        self.edit_json(fonts.MANIFEST, lambda data: data['fonts'][0].update(weight='400 900'))
        with self.assertRaisesRegex(ValueError, 'stale or modified'):
            fonts.check(self.root)

    def test_recipe_and_lock_changes_invalidate_outputs(self):
        for relative in (fonts.SCRIPT, fonts.LOCK):
            with self.subTest(relative=relative):
                self.mutate(relative)
                with self.assertRaisesRegex(ValueError, 'stale or modified'):
                    fonts.check(self.root)
                shutil.copyfile(fonts.ROOT / relative, self.root / relative)

    def test_css_changes_are_detected(self):
        self.mutate(fonts.CSS)
        with self.assertRaisesRegex(ValueError, 'fonts.css is stale'):
            fonts.check(self.root)


@unittest.skipUnless(importlib.util.find_spec('fontTools'), 'Only generation needs FontTools')
class RealFontPreservationTests(unittest.TestCase):
    def test_every_real_font_preserves_cmaps_axes_and_metrics(self):
        from fontTools.ttLib import TTFont

        saved = json.loads((fonts.ROOT / fonts.MANIFEST).read_text('utf-8'))
        for face in saved['fonts']:
            filename = Path(face['source']['file']).name
            with self.subTest(filename=filename):
                with TTFont(fonts.ROOT / fonts.NATIVE / 'src/main/res/font' / filename) as source:
                    with TTFont(fonts.ROOT / face['output']['file']) as output:
                        fonts.compare_fonts(source, output)
                        output['fvar'].axes[0].maxValue -= 1
                        with self.assertRaisesRegex(ValueError, 'Variable axes changed'):
                            fonts.compare_fonts(source, output)


if __name__ == '__main__':
    unittest.main()
