"""Local art repairs must remain resumable and preserve the native export."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from creature_archive import archive_inputs
from model_build_queue import BuildQueue
from production_sources import source_file, geometry_source, refine_source


class SourceRepairs(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        self.entry = {'slug': 'wolf', 'itemId': 1692, 'sourceRepair': {'kind': 'dark-fur'}}
        self.native = self.folder / 'trellis-native/generated-original.glb'
        self.native.parent.mkdir()
        self.native.write_bytes(b'original native')
        self.recipe = {'sourceRepair': self.entry['sourceRepair'], 'calibration': {'sourceDiameter': .6}}
        self.save_recipe()
        self.queue = BuildQueue({'schema': 1, 'entries': [self.entry], 'budget': {'allowPaidOverquota': False}}, self.folder)
        self.calls = 0

    def save_recipe(self):
        (self.folder / 'recipe.json').write_text(json.dumps(self.recipe))

    def refine(self):
        def execute(command, log):
            self.calls += 1
            out = self.folder / 'source-repair'
            out.mkdir(exist_ok=True)
            for name in ['repaired-source.glb', 'repair.blend', 'repair-report.json', 'colour-0.png', 'orm-0.png']:
                (out / name).write_bytes(b'local derivative')
        refine_source(self.entry, self.folder,
                      lambda name, inputs, action: self.queue.stage(self.entry, name, inputs, action),
                      execute, 'blender', Path('scripts'), lambda *names: dict.fromkeys(names, 'hash'))

    def test_cache_invalidates_on_repair_or_calibration_but_never_overwrites_native(self):
        self.refine()
        self.refine()
        self.assertEqual(self.calls, 1)
        self.entry['sourceRepair'] = {'kind': 'dark-fur', 'strength': .1}
        self.refine()
        self.assertEqual(self.calls, 2)
        self.recipe['calibration']['sourceDiameter'] = .7
        self.save_recipe()
        self.refine()
        self.assertEqual(self.calls, 3)
        self.assertEqual(self.native.read_bytes(), b'original native')
        self.assertEqual(source_file(self.entry, self.folder), self.folder / 'source-repair/repaired-source.glb')
        self.assertEqual(source_file({}, self.folder), self.native)

    def test_reviewed_baseline_does_not_replace_material_source(self):
        self.entry['geometryBaseline'] = 'baseline.glb'
        self.assertEqual(geometry_source(self.entry, self.folder), self.folder / 'baseline.glb')
        self.assertNotEqual(source_file(self.entry, self.folder), geometry_source(self.entry, self.folder))
        for invalid in ['../outside.glb', '/outside.glb']:
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                geometry_source(dict(geometryBaseline=invalid), self.folder)
        outside = tempfile.TemporaryDirectory()
        self.addCleanup(outside.cleanup)
        (self.folder / 'linked').symlink_to(outside.name, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'inside the model folder'):
            geometry_source({'geometryBaseline': 'linked/model.glb'}, self.folder)


    def test_archive_retains_both_sources_and_only_explicit_repair_assets(self):
        self.refine()
        self.recipe['build'] = {'geometryBaseline': 'baseline.glb'}
        self.recipe['reviewBase'] = {'file': 'base.glb'}
        self.save_recipe()
        (self.folder / 'source-repair/private.env').write_text('private')
        # The archive's existing tests cover mandatory regular-file validation.
        with patch('creature_archive.Path.is_file', return_value=True):
            files = archive_inputs(self.folder, 'ready')
        self.assertEqual(files['native/generated-original.glb'], self.native)
        self.assertEqual(files['inputs/baseline-render.glb'], self.folder / 'baseline.glb')
        for name in ['repaired-source.glb', 'repair.blend', 'repair-report.json', 'colour-0.png', 'orm-0.png']:
            self.assertIn('source-repair/' + name, files)
        self.assertNotIn('source-repair/private.env', files)
        for invalid in ['../private.env', '/private.env']:
            self.recipe['build']['geometryBaseline'] = invalid
            self.save_recipe()
            with self.assertRaisesRegex(ValueError, 'inside the model folder'):
                archive_inputs(self.folder, 'native')


if __name__ == '__main__':
    unittest.main()
