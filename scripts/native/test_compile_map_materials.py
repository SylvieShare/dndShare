"""Regression coverage for a compiler that exits successfully without producing a package."""
import contextlib
import importlib.util
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("map_materials", Path(__file__).with_name("compile-map-materials.py"))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class MaterialBuildTests(unittest.TestCase):
    def test_success_exit_without_output_cannot_reuse_a_stale_package(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            sources = root / "native/androidApp/materials"
            output = root / "native/androidApp/src/main/assets/maps/materials"
            sources.mkdir(parents=True)
            output.mkdir(parents=True)
            (sources / "test.mat").write_text("material {}")
            (sources / "shared.glsl").write_text("void fragment() {}")
            package = output / "test.filamat"
            package.write_bytes(b"stale package")
            manifest = output / "manifest.json"
            manifest.write_text("previous manifest")
            compiler = root / "matc"
            compiler.write_text("#!/usr/bin/env python3\nimport sys\nif '--version' in sys.argv: print('77')\n")
            compiler.chmod(0o755)
            with patch.object(MODULE, "ROOT", root), patch.object(MODULE, "default_compiler", return_value=compiler), patch.object(sys, "argv", ["materials"]):
                with self.assertRaisesRegex(RuntimeError, "did not create test.filamat"):
                    MODULE.main()
            self.assertFalse(package.exists())
            self.assertEqual("previous manifest", manifest.read_text())

    def test_checks_reject_a_missing_variant_even_if_recorded_hashes_match(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            sources = root / "native/androidApp/materials"
            output = root / "native/androidApp/src/main/assets/maps/materials"
            sources.mkdir(parents=True)
            output.mkdir(parents=True)
            material = sources / "water.mat"
            variant = sources / "water-blend.mat"
            material.write_text("material {}")
            variant.write_text("material {}")
            (output / "manifest.json").write_text(json.dumps({
                "version": MODULE.VERSION,
                "sources": {p.name: MODULE.digest(p) for p in (material, variant)},
                "outputs": {},
            }))
            with patch.object(MODULE, "ROOT", root), patch.object(MODULE, "default_compiler", return_value=root / "matc"), patch.object(sys, "argv", ["materials", "--check"]), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit):
                    MODULE.main()


if __name__ == "__main__":
    unittest.main()
