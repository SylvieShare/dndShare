"""Navigation checks for the isolated native/API smoke account."""
import re


class NavigationSmoke:
    def __init__(self, shell, tree, tap, wait_for, snapshot):
        self.shell, self.tree, self.tap = shell, tree, tap
        self.wait_for, self.snapshot = wait_for, snapshot

    @staticmethod
    def described(root, description):
        return [node for node in root.iter("node") if node.get("content-desc") == description]

    def open_menu(self):
        root = self.tree()
        for description in ["Открыть меню", "Раскрыть панель"]:
            controls = self.described(root, description)
            if controls:
                self.tap(controls[0])
                return self.wait_for("ДЛЯ ИГРОКА")
        return root

    def navigate(self, title):
        root = self.tree()
        targets = self.described(root, "Раздел: " + title)
        if not targets:
            root = self.open_menu()
            targets = self.described(root, "Раздел: " + title)
        assert targets, f"Missing destination: {title}"
        self.tap(targets[-1])
        return self.wait_for(title)

    def phone(self):
        self.shell("input", "swipe", "32", "420", "310", "420", "350")
        root = self.wait_for("ДЛЯ ИГРОКА")
        for title in ["Справочник", "Правила игрока", "Персонажи", "Сессии", "Карты"]:
            assert self.described(root, "Раздел: " + title), f"Missing web destination: {title}"
        assert not self.described(root, "Раздел: Админка"), "Player must not see admin navigation"
        self.snapshot("phone-menu")
        self.shell("input", "keyevent", "4")
        root = self.wait_for("Native Flame")
        assert not self.described(root, "Закрыть меню"), "Back should close the drawer"
        for title in ["Правила игрока", "Сессии", "Карты"]:
            self.navigate(title)
            self.wait_for("Скоро в приложении")
        self.snapshot("phone-placeholder")
        root = self.open_menu()
        self.tap(self.described(root, "Аккаунт")[0])
        root = self.wait_for("Выйти")
        self.tap([n for n in root.iter("node") if n.get("text") == "Аккаунт"][-1])
        self.wait_for("Профиль, пароль и использование пространства.")
        self.navigate("Справочник")
        self.wait_for("Native Flame")
        print("PASS: swipe drawer, web destinations, placeholders and account", flush=True)

    def detail_back(self):
        self.open_menu()
        self.shell("input", "keyevent", "4")
        root = self.tree()
        assert not self.described(root, "Закрыть меню"), "Drawer Back must preserve the opened record"
        self.wait_for("Это описание из локальной базы.")

    def transitions(self):
        root = self.tree()
        positions = {}
        for title in ["Правила игрока", "Карты", "Персонажи", "Справочник"]:
            node = self.described(root, "Раздел: " + title)[0]
            left, top, right, bottom = map(int, re.findall(r"\d+", node.get("bounds", "")))
            positions[title] = ((left + right) // 2, (top + bottom) // 2)

        def switch_quickly():
            sequence = ["Правила игрока", "Справочник", "Персонажи", "Карты", "Справочник"] * 2
            commands = [f"input tap {positions[title][0]} {positions[title][1]}" for title in sequence]
            self.shell("; ".join(commands))
            result = self.wait_for("Это описание из локальной базы.")
            visible = [n for n in result.iter("node") if "Это описание из локальной базы." in n.get("text", "")]
            assert len(visible) == 1, "Section reversals must retain one visible record and its saved state"

        switch_quickly()
        previous_scale = self.shell("settings", "get", "global", "animator_duration_scale")
        try:
            self.shell("settings", "put", "global", "animator_duration_scale", "0")
            self.tree()  # Let the app observe the system setting before navigating.
            switch_quickly()
        finally:
            if previous_scale == "null":
                self.shell("settings", "delete", "global", "animator_duration_scale")
            else:
                self.shell("settings", "put", "global", "animator_duration_scale", previous_scale)
        print("PASS: rapid section reversals, saved record and system animations disabled", flush=True)

    def adaptive(self, layout):
        root = self.tree()
        if layout == "tablet":
            assert self.described(root, "Открыть меню"), "Tablet should have a hidden menu with a header opener"
            assert not self.described(root, "Раскрыть панель"), "Tablet must not retain a rail behind the drawer"
            self.open_menu()
            self.snapshot("tablet-menu")
            self.navigate("Карты")
            self.wait_for("Скоро в приложении")
            self.navigate("Справочник")
        else:
            controls = self.described(root, "Свернуть панель")
            assert controls, "Wide windows should start with an expanded sidebar"
            self.tap(controls[0])
            root = self.tree()
            assert self.described(root, "Раскрыть панель"), "Wide sidebar should collapse"
            self.snapshot("wide-collapsed")
            self.open_menu()
        self.wait_for("Это описание из локальной базы.")
