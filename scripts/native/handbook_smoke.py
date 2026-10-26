"""Read-only handbook design checks against the real isolated API fixture."""
import time


class HandbookSmoke:
    def __init__(self, shell, tree, tap, click, wait_for, snapshot):
        self.shell, self.tree, self.tap, self.click = shell, tree, tap, click
        self.wait_for, self.snapshot = wait_for, snapshot

    def overview_and_search(self):
        self.wait_for("205")
        self.wait_for("Основные разделы")
        self.snapshot("phone-handbook-overview")
        self.click("Заклинания")
        self.wait_for("Native Flame")
        root = self.tree()
        field = next(n for n in root.iter("node") if n.get("class") == "android.widget.EditText")
        self.tap(field)
        self.tree()  # The software keyboard must be ready before input text injects key events.
        for character in "Native":
            self.shell("input", "text", character)
        root = self.wait_for("2")
        assert not any(n.get("text", "").startswith("Spell ") for n in root.iter("node")), "Search leaked unfiltered rows"
        self.shell("input", "keyevent", "4")
        self.click("Фильтры и источники")
        self.wait_for("Готово")
        self.snapshot("phone-handbook-filters")
        self.click("Готово")
        root = self.tree()
        clear = next(n for n in root.iter("node") if n.get("content-desc") == "Очистить поиск")
        self.tap(clear)
        self.wait_for("205")
        self.snapshot("phone-handbook-collection")
        print("PASS: collection overview, local search/count, native filters and clear", flush=True)

    def enter_collection_if_needed(self):
        deadline = time.monotonic() + 55
        while time.monotonic() < deadline:
            root = self.tree()
            texts = [n.get("text") for n in root.iter("node")]
            if "Заклинания" in texts and not any((text or "").startswith("Native Flame") for text in texts):
                self.click("Заклинания")
                return self.wait_for("Native Flame")
            if any((text or "").startswith("Native Flame") for text in texts):
                return root
            time.sleep(.2)
        raise AssertionError("Handbook did not restore its overview or cached collection")
