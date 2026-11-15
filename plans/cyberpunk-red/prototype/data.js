window.RED = {};
RED.roles = [
  [
    "rockerboy",
    "Рокер",
    "Rockerboy",
    "Харизматическое влияние",
    "Сцена, аудитория, люди, готовые пойти за тобой.",
  ],
  [
    "solo",
    "Соло",
    "Solo",
    "Боевое чутьё",
    "Профессионал, который знает цену каждой секунде боя.",
  ],
  [
    "netrunner",
    "Нетраннер",
    "Netrunner",
    "Интерфейс",
    "Путь через закрытые системы и опасные NET-архитектуры.",
  ],
  [
    "tech",
    "Техник",
    "Tech",
    "Изобретатель",
    "Ремонт, модернизация, изготовление и собственные проекты.",
  ],
  [
    "medtech",
    "Медтехник",
    "Medtech",
    "Медицина",
    "Спасти жизнь, когда обычной первой помощи недостаточно.",
  ],
  [
    "media",
    "Медиа",
    "Media",
    "Достоверность",
    "Расследования, источники и истории, которые меняют город.",
  ],
  [
    "lawman",
    "Законник",
    "Lawman",
    "Подкрепление",
    "Значок, связи и помощь в самый напряжённый момент.",
  ],
  [
    "exec",
    "Корпорат",
    "Exec",
    "Командная работа",
    "Ресурсы корпорации, своя команда и большие обязательства.",
  ],
  [
    "fixer",
    "Фиксер",
    "Fixer",
    "Оператор",
    "Найти нужного человека, товар и подходящую цену.",
  ],
  [
    "nomad",
    "Кочевник",
    "Nomad",
    "Мотор",
    "Семья, транспорт и свобода передвижения.",
  ],
];
RED.stats = [
  ["INT", "Интеллект"],
  ["REF", "Реакция"],
  ["DEX", "Ловкость"],
  ["TECH", "Техника"],
  ["COOL", "Хладнокровие"],
  ["WILL", "Воля"],
  ["LUCK", "Удача"],
  ["MOVE", "Движение"],
  ["BODY", "Телосложение"],
  ["EMP", "Эмпатия"],
];
RED.skills = [
  ["Внимательность", "INT", 6, "Восприятие"],
  ["Сосредоточение", "WILL", 2, "Восприятие"],
  ["Пистолеты", "REF", 6, "Бой"],
  ["Уклонение", "DEX", 6, "Бой"],
  ["Рукопашный бой", "DEX", 2, "Бой"],
  ["Электроника и безопасность", "TECH", 6, "Техника", 2],
  ["Базовая техника", "TECH", 4, "Техника"],
  ["Первая помощь", "TECH", 2, "Техника"],
  ["Атлетика", "DEX", 2, "Тело"],
  ["Скрытность", "DEX", 4, "Тело"],
  ["Беседа", "EMP", 2, "Общение"],
  ["Проницательность", "EMP", 2, "Общение"],
  ["Убеждение", "COOL", 2, "Общение"],
  ["Образование", "INT", 2, "Знания"],
  ["Знание района: Уотсон", "INT", 2, "Знания"],
  ["Язык: Streetslang", "INT", 2, "Знания"],
];
RED.defaultState = {
  view: "sheet",
  tab: "base",
  hp: 32,
  humanity: 52,
  cash: 350,
  luck: 5,
  ammo: 8,
  role: "netrunner",
  step: 0,
  method: "complete",
  name: "Ника «STATIC»",
  stats: {
    INT: 7,
    REF: 8,
    DEX: 6,
    TECH: 7,
    COOL: 5,
    WILL: 6,
    LUCK: 5,
    MOVE: 6,
    BODY: 6,
    EMP: 6,
  },
  notes: "Связаться с Линой перед встречей у старой станции.",
  lifepath: "Выросла в Уотсоне. Чинит чужие секреты и бережёт своих.",
  draftDone: false,
};
try {
  RED.state = {
    ...RED.defaultState,
    ...JSON.parse(localStorage.getItem("red-design-v1") || "{}"),
  };
} catch {
  RED.state = { ...RED.defaultState };
}
RED.escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
RED.role = () => RED.roles.find((r) => r[0] === RED.state.role) || RED.roles[2];
RED.save = () => {
  try {
    localStorage.setItem("red-design-v1", JSON.stringify(RED.state));
  } catch {}
};
RED.toast = (text) => {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.style.display = "block";
  clearTimeout(RED.toastTimer);
  RED.toastTimer = setTimeout(() => (el.style.display = "none"), 3200);
};
RED.modal = (html) => {
  document.getElementById("dialog-content").innerHTML = html;
  document.getElementById("dialog").showModal();
};
RED.metric = (title, value, max, kind = "") =>
  `<div><div class="caption">${title}</div><div class="metric">${value} <small>/ ${max}</small></div><div class="bar ${kind}"><span style="width:${Math.max(0, Math.min(100, (value / max) * 100))}%"></span></div></div>`;
RED.tabs = [
  ["base", "База"],
  ["skills", "Навыки"],
  ["combat", "Бой"],
  ["cyber", "Киберware"],
  ["net", "Сеть"],
  ["gear", "Предметы"],
  ["role", "Роль"],
  ["life", "Жизнь"],
  ["journal", "Дневник"],
];
