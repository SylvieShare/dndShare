import contextlib
import importlib.util
import io
from pathlib import Path
import sys
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location("check_wiki", SCRIPTS / "check-wiki.py")
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class WikiCheckerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.write("README.md", "# Project\n\n[Wiki](md/README.md)")
        self.write("md/README.md", "# Wiki\n\n[Topic](topic.md)")
        self.write("md/topic.md", "# Topic\n\n## Related\n\n[Wiki](README.md)")

    def write(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def run_check(self, strict=False):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            result = checker.check(self.root, strict=strict)
        return result, output.getvalue()

    def test_valid_links_and_unicode_duplicate_anchors(self):
        self.write("md/topic.md", "# Topic\n\n[second](#повтор-1)\n\n## Повтор\n\none\n\n## Повтор\n\ntwo\n\n[Wiki](README.md)")
        self.assertEqual(self.run_check(True)[0], 0)

    def test_missing_target_anchor_and_source_are_errors(self):
        for extra in ["[missing](absent.md)", "[missing](#absent)", "`frontend/src/absent.js`"]:
            with self.subTest(extra=extra):
                self.write("md/topic.md", "# Topic\n\n" + extra)
                self.assertEqual(self.run_check()[0], 1)

    def test_unreachable_page_is_an_error(self):
        self.write("md/orphan.md", "# Orphan")
        result, output = self.run_check()
        self.assertEqual(result, 1)
        self.assertIn("unreachable", output)

    def test_skill_readme_links_are_checked_outside_wiki(self):
        self.write("skills/example/SKILL.md", "# Skill\n\n[Missing instructions](missing.md)")
        self.assertEqual(self.run_check()[0], 1)

    def test_proposed_implementation_paths_need_not_exist(self):
        self.write("plans/example.md", "# Proposal\n\n`frontend/src/future.vue`\n\n[Wiki](../md/README.md)")
        self.assertEqual(self.run_check(True)[0], 0)

    def test_dated_proposals_are_not_current_contract_history(self):
        self.write("plans/example.md", "# Proposal\n\n## Input audit 2026-10-26\n\nNot yet implemented.")
        self.assertEqual(self.run_check(True)[0], 0)

    def test_trailing_prose_warns_and_strict_mode_fails(self):
        self.write("md/topic.md", "# Topic\n\n## Связанные страницы\n\n[Wiki](README.md)\n\nForgotten addition.")
        self.assertEqual(self.run_check()[0], 0)
        result, output = self.run_check(True)
        self.assertEqual(result, 1)
        self.assertIn("content-after-related", output)

    def test_footer_last_is_valid(self):
        self.write("md/topic.md", "# Topic\n\nbody\n\n## Связанные страницы\n\n[Wiki](README.md)")
        self.assertEqual(self.run_check(True)[0], 0)

    def test_examples_inside_code_fences_are_not_links_or_footer_sections(self):
        self.write("md/topic.md", "# Topic\n\n```md\n## Связанные страницы\n\n[missing](absent.md)\n\nexample\n```\n\n[Wiki](README.md)")
        self.assertEqual(self.run_check(True)[0], 0)

    def test_size_warning_checks_both_lines_and_characters(self):
        for content in ["line\n" * 601, "x" * 60001]:
            with self.subTest(length=len(content)):
                self.write("md/topic.md", content)
                result, output = self.run_check(True)
                self.assertEqual(result, 1)
                self.assertIn("oversized-page", output)

    def test_report_needs_status_and_snapshot(self):
        self.write("md/README.md", "# Wiki\n\n[Topic](topic.md) · [Report](reports/check.md)")
        self.write("md/reports/check.md", "# Old result\n\nSome numbers.")
        result, output = self.run_check(True)
        self.assertEqual(result, 1)
        self.assertIn("report-status", output)
        self.assertIn("report-snapshot", output)

    def test_report_with_commit_does_not_invent_measurement_date(self):
        self.write("md/README.md", "# Wiki\n\n[Topic](topic.md) · [Report](reports/check.md)")
        self.write("md/reports/check.md", "# Old result\n\nСтатус: исторический отчёт. Commit документа: `12345678`.\n\nOld numbers.")
        self.assertEqual(self.run_check(True)[0], 0)

    def test_dated_history_in_current_contract_warns(self):
        self.write("md/topic.md", "# Current\n\n## Update 2026-10-26\n\nSome numbers.")
        self.assertIn("dated-current-section", self.run_check(True)[1])

    def test_editions_are_not_dates_and_scoped_journals_can_have_dates(self):
        for body in ["# Rules\n\n## D&D 2014 and 2024", "# Model log\n\nСтатус: журнал конкретных моделей.\n\n## Work 2026-10-26"]:
            self.write("md/topic.md", body)
            self.assertEqual(self.run_check(True)[0], 0)


if __name__ == "__main__":
    unittest.main()
