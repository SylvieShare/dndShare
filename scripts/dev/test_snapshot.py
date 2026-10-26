"""Snapshot integrity tests using only disposable local files and git."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from scripts.dev.common import UIError, read_json
from scripts.dev import snapshot


class SnapshotTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        subprocess.run(["git", "init", "-q", self.root], check=True)
        self.put("README.md", b"hello\r\n")
        self.put(".gitignore", b"build/\nnode_modules/\n")
        self.put("frontend/package-lock.json", b"{}\n")
        subprocess.run(["git", "add", "."], cwd=self.root, check=True)
        subprocess.run(["git", "-c", "user.name=Test", "-c", "user.email=test@localhost",
                        "commit", "-qm", "fixture"], cwd=self.root, check=True)
        modules = self.root / "build/modules"
        modules.mkdir(parents=True)
        self.config = {"node_modules": str(modules)}

    def put(self, name, data):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return path

    def prepare(self):
        hot = self.root / "hot"
        hot.mkdir(exist_ok=True)
        with patch("scripts.dev.snapshot.tempfile.mkdtemp", return_value=str(hot)):
            # No dependency package manager or production process participates in these tests.
            workspace, manifest = snapshot.prepare(self.root, self.config)
        manifest["hotCache"] = str(Path(tempfile.gettempdir()) / ("dndshare-ui-test-" + self.root.name))
        from scripts.dev.common import write_json
        write_json(workspace / snapshot.MANIFEST, manifest)
        self.addCleanup(__import__("shutil").rmtree, manifest["hotCache"], True)
        return workspace, manifest

    def test_hash_ignores_mtime_crlf_and_runtime(self):
        initial = snapshot.current(self.root)
        os.utime(self.root / "README.md", (10, 10))
        self.put("README.md", b"hello\n")
        self.put("frontend/target/stale.js", b"stale")
        self.put("native/androidApp/build/output.bin", b"stale")
        self.put("scripts/x/__pycache__/cache.pyc", b"cache")
        self.put("resources/.env.local", b"secret")
        self.put("models/private.glb", b"private")
        self.assertEqual(initial, snapshot.current(self.root))
        self.put("resources/data.json", b"{}")
        self.assertNotEqual(initial, snapshot.current(self.root))

    def test_full_roots_testdata_lf_and_no_secrets(self):
        for name in ("resources/fixture.json", "internal/web/testdata/root.json", "scripts/testdata/foo.txt"):
            self.put(name, b"fixture\r\n")
        self.put(".env", b"SECRET")
        self.put("frontend/.env.production", b"SECRET")
        self.put("models/data.bin", b"SECRET")
        workspace, manifest = self.prepare()
        self.assertEqual((workspace / "resources/fixture.json").read_bytes(), b"fixture\n")
        self.assertIn("internal/web/testdata/root.json", manifest["files"])
        self.assertIn("scripts/testdata/foo.txt", manifest["files"])
        self.assertFalse((workspace / ".env").exists())
        self.assertFalse((workspace / "frontend/.env.production").exists())
        self.assertFalse((workspace / "models").exists())
        snapshot.validate(self.root, workspace, self.config)

    def test_stale_requires_explicit_snapshot(self):
        workspace, _ = self.prepare()
        self.put("README.md", b"changed")
        with self.assertRaisesRegex(UIError, "Stale"):
            snapshot.validate(self.root, workspace, self.config)
        snapshot.validate(self.root, workspace, self.config, frozen=True)
        (workspace / "README.md").write_bytes(b"tampered")
        with self.assertRaisesRegex(UIError, "modified"):
            snapshot.validate(self.root, workspace, self.config, frozen=True)

    def test_prepare_never_replaces_existing_directory(self):
        workspace, _ = self.prepare()
        sentinel = workspace / "belongs-to-another-agent"
        sentinel.write_text("keep")
        with self.assertRaisesRegex(UIError, "already exists"):
            snapshot.prepare(self.root, self.config, workspace)
        self.assertEqual(sentinel.read_text(), "keep")
        with self.assertRaisesRegex(UIError, "new directory"):
            snapshot.prepare(self.root, self.config, self.root / "foreign")

    def test_source_symlink_is_rejected(self):
        (self.root / "resources").mkdir()
        (self.root / "resources/escape").symlink_to(self.root / "README.md")
        with self.assertRaisesRegex(UIError, "symlink"):
            snapshot.current(self.root)

    def test_workspace_additions_and_environment_injection_fail(self):
        workspace, _ = self.prepare()
        extra = workspace / "frontend/src/extra.js"
        extra.parent.mkdir(parents=True)
        extra.write_text("extra")
        with self.assertRaisesRegex(UIError, "selection was modified"):
            snapshot.validate(self.root, workspace, self.config, frozen=True)
        extra.unlink()
        (workspace / "frontend/.env").write_text("secret")
        with self.assertRaisesRegex(UIError, "Environment files"):
            snapshot.validate(self.root, workspace, self.config, frozen=True)

    def test_tracked_embed_placeholder_is_preserved(self):
        self.put("internal/assets/dist/.gitkeep", b"")
        workspace, manifest = self.prepare()
        self.assertIn("internal/assets/dist/.gitkeep", manifest["files"])
        snapshot.validate(self.root, workspace, self.config)
