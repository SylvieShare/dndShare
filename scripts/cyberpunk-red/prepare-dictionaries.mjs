import fs from "node:fs";
import {
  RED_STATS,
  RED_SKILLS,
  RED_ROLES,
  RED_SKILL_GROUPS,
} from "../../frontend/src/features/character-editor/settings/cyberpunk-red/catalogue.js";
import { RED_ROLE_DESCRIPTIONS } from "../../frontend/src/features/character-editor/settings/cyberpunk-red/roleInfo.js";
import { addCoreExtras } from "./core-extras.mjs";
const path = new URL("../../internal/cyberpunkred/core.json", import.meta.url);
const core = JSON.parse(fs.readFileSync(path, "utf8"));
const rows = (pairs) =>
  pairs.map(([key, name]) => ({ key, name, description: "" }));
for (const item of core.items) {
  if (item.kind === "role")
    item.summary =
      RED_ROLE_DESCRIPTIONS[item.nameEn.toLowerCase()] || item.summary;
  if (["role", "criticalInjury"].includes(item.kind)) {
    delete item.facts.price;
    delete item.facts.quantity;
  }
}
core.dictionaries = {
  ...core.referenceDictionaries,
  Характеристики: RED_STATS.map((s) => ({ ...s, description: s.key })),
  Навыки: RED_SKILLS.map((s) => ({
    key: s.key,
    name: s.name,
    description: `${s.statKey}; стоимость ×${s.costMultiplier}${s.specializationKind ? "; требуется специализация" : ""}`,
  })),
  Роли: RED_ROLES.map((r) => ({
    key: r.key,
    name: r.name,
    description: r.originalName,
  })),
  "Группы навыков": rows(Object.entries(RED_SKILL_GROUPS)),
  Валюта: rows([["eb", "Евробакс"]]),
  "Качество оружия": rows([
    ["poor", "Низкое"],
    ["standard", "Обычное"],
    ["excellent", "Высокое"],
  ]),
  "Места установки": rows([
    ["mall", "Торговый центр"],
    ["clinic", "Клиника"],
    ["hospital", "Госпиталь"],
  ]),
  "Состояния ранений": rows([
    ["healthy", "Без ранений"],
    ["light", "Лёгкое ранение"],
    ["serious", "Тяжёлое ранение"],
    ["mortal", "Смертельное ранение"],
    ["dead", "Смерть"],
  ]),
  Локализации: rows([
    ["head", "Голова"],
    ["body", "Тело"],
    ["left-arm", "Левая рука"],
    ["right-arm", "Правая рука"],
    ["left-leg", "Левая нога"],
    ["right-leg", "Правая нога"],
  ]),
  "Методы создания": rows([
    ["streetrat", "Уличная крыса"],
    ["edgerunner", "Эджраннер"],
    ["complete", "Полный пакет"],
  ]),
  "Категории цен": [10, 20, 50, 100, 500, 1000, 5000, 10000].map(
    (price, i) => ({
      key: String(price),
      name: [
        "Дешёвое",
        "Обычное",
        "Ценное",
        "Премиум",
        "Дорогое",
        "Очень дорогое",
        "Роскошь",
        "Суперроскошь",
      ][i],
      description: `${price} eb${i === 7 ? " и выше" : ""}`,
    }),
  ),
  Действия: rows([
    ["attack", "Атака"],
    ["move", "Перемещение"],
    ["run", "Бег"],
    ["reload", "Перезарядка"],
    ["aim", "Прицельный выстрел"],
    ["grapple", "Захват"],
    ["choke", "Удушение"],
    ["throw", "Бросок"],
    ["stabilize", "Стабилизация"],
    ["hold", "Удержать действие"],
    ["stand", "Встать"],
    ["skill", "Применить навык"],
    ["object", "Использовать предмет"],
  ]),
  "NET-действия": rows(
    [
      "backdoor",
      "cloak",
      "control",
      "eyedee",
      "pathfinder",
      "scanner",
      "slide",
      "virus",
      "zap",
    ].map((x) => [x, x[0].toUpperCase() + x.slice(1)]),
  ),
};
addCoreExtras(core);
fs.writeFileSync(path, JSON.stringify(core, null, 2) + "\n");
console.log(
  `${Object.keys(core.dictionaries).length} dictionaries, ${Object.values(core.dictionaries).reduce((n, a) => n + a.length, 0)} values`,
);
