// Factual supplements transcribed from the supplied Core, pp. 149–150, 377–378.
import { addNetFacts } from "./net-facts.mjs";
import { correctDrugs } from "./drug-facts.mjs";
import { completeInjuries } from "./injury-facts.mjs";
import { completeWeapons } from "./weapon-facts.mjs";
import { addRedEnums } from "./enum-facts.mjs";
export function addCoreExtras(core) {
  const extras = [];
  core.groups.pharmaceuticals = "Фармацевтика";
  const medicines = [
    [
      "antibiotic",
      "Антибиотик",
      "Antibiotic",
      "Во время естественного восстановления добавляет 2 HP в день на протяжении недели. Повторные дозы не складываются.",
    ],
    [
      "rapid-detox",
      "Быстрый детокс",
      "Rapidetox",
      "Снимает действующее отравление, интоксикацию или действие наркотика.",
    ],
    [
      "speedheal",
      "Спидхил",
      "Speedheal",
      "Восстанавливает BODY + WILL HP, если цель не смертельно ранена. Польза от одной дозы в день.",
    ],
    [
      "stim",
      "Стимулятор",
      "Stim",
      "На один час снимает штраф тяжёлого ранения. Польза от одной дозы в день.",
    ],
    [
      "surge",
      "Всплеск",
      "Surge",
      "Позволяет бодрствовать 24 часа. Польза от одной дозы в неделю.",
    ],
  ];
  for (const [key, name, nameEn, summary] of medicines)
    extras.push({
      key: "pharma-" + key,
      name,
      nameEn,
      summary: summary + " Правильное введение требует Медтехника.",
      category: "pharmaceuticals",
      kind: "pharmaceutical",
      page: 150,
      facts: { manufactureDV: 13, batchCost: 200, hours: 1 },
    });
  core.groups.housing = "Жильё";
  core.groups.lifestyle = "Образ жизни";
  for (const [key, name, rent, buy] of [
    ["street", "Улица", 0, 0],
    ["car", "Машина на улице", 0, 0],
    ["cube-hotel", "Кубический отель", 500, 0],
    ["cargo-container", "Грузовой контейнер", 1000, 15000],
    ["studio", "Студия", 1500, 25000],
    ["two-bedroom", "Двухкомнатные апартаменты", 2500, 35000],
    ["corporate-conapt", "Корпоративный конапт", 0, 0],
    ["upscale-conapt", "Высококлассный конапт", 7500, 85000],
    ["penthouse", "Роскошный пентхаус", 15000, 150000],
    ["corporate-suburb", "Корпоративный дом", 0, 200000],
    ["corporate-mansion", "Корпоративный особняк", 0, 500000],
  ])
    extras.push({
      key: "housing-" + key,
      name,
      nameEn: key,
      summary: key.startsWith("corporate-")
        ? "Аренда оплачивается корпорацией при наличии соответствующих привилегий роли."
        : `Расходы на жильё: ${rent} eb в месяц.`,
      category: "housing",
      kind: "housing",
      page: 378,
      facts: { rent, buy },
    });
  for (const [key, name, price] of [
    ["kibble", "Киббл", 100],
    ["generic-prepak", "Дешёвый полуфабрикат", 300],
    ["good-prepak", "Хороший полуфабрикат", 600],
    ["fresh-food", "Свежая еда", 1500],
  ])
    extras.push({
      key: "lifestyle-" + key,
      name,
      nameEn: key,
      summary: `Образ жизни на месяц: ${price} eb. Дополнительные потребности оплачиваются отдельно.`,
      category: "lifestyle",
      kind: "lifestyle",
      page: 377,
      facts: { monthlyCost: price },
    });
  const keys = new Set(extras.map((i) => i.key));
  core.items = core.items.filter((i) => !keys.has(i.key)).concat(extras);
  core.dictionaries["Фармацевтические препараты"] = medicines.map(
    ([key, name]) => ({
      key,
      name,
      description: "Core 150; требуется обучение Медтехника",
    }),
  );
  addNetFacts(core);
  correctDrugs(core);
  completeInjuries(core);
  completeWeapons(core);
  addRedEnums(core);
  const martial = core.items.find((i) => i.key === "weapon-martial-arts");
  if (martial) {
    martial.facts.skill = "martial-arts";
    martial.summary =
      "Урон зависит от BODY: 1d6 при 1–4, 2d6 при 5–6, 3d6 при 7–10, 4d6 при 11+. Игнорирует половину SP; выберите изученное боевое искусство.";
  }
  const unarmed = core.items.find((i) => i.key === "weapon-unarmed");
  if (unarmed)
    unarmed.summary =
      "Урон зависит от BODY: 1d6 при 1–4, 2d6 при 5–6, 3d6 при 7–10, 4d6 при 11+. Броня действует полностью.";
  const programSummaries = {
    "program-armor":
      "Пока активна, уменьшает урон мозгу на 4. Одна активная копия; каждую копию можно включить один раз за подключение.",
    "program-flak":
      "Пока активна, ATK атакующих вас программ, кроме Чёрного ЛЬДА, считается 0. Одна активная копия; одна активация за подключение.",
    "program-shield":
      "Отменяет первый успешный эффект обычной программы, наносящий урон мозгу, затем выключается. Не действует против Чёрного ЛЬДА; одна активная копия и одна активация за подключение.",
    "program-deckkrash":
      "Вынуждает цель небезопасно отключиться; ведущий применяет эффекты преследующего Чёрного ЛЬДА.",
    "program-nervescrub": "На час уменьшает INT, REF и DEX на 1d6, минимум 1.",
    "program-poison-flatline":
      "Уничтожает случайную программу на деке цели, кроме Чёрного ЛЬДА.",
    "program-superglue":
      "На 1d6 раундов блокирует продвижение и безопасное отключение цели. Одна активация копии за подключение.",
    "program-hellbolt":
      "Наносит 2d6 урона мозгу; без теплоизоляции дека и одежда горят на 2 HP/ход до тушения.",
    "program-vrizzbolt":
      "Наносит 1d6 урона мозгу; в следующий ход на одно NET-действие меньше, минимум два.",
  };
  for (const item of core.items) {
    if (programSummaries[item.key]) item.summary = programSummaries[item.key];

    if (item.key === "cyberware-sandevistan")
      item.facts.bonuses = [
        { target: "initiative", value: 3, conditional: false },
      ];
    if (item.key === "cyberware-pain-editor")
      item.facts.bonuses = [
        { target: "pain-suppression", value: 1, conditional: false },
      ];
    if (item.key === "cyberware-techhair" || item.key === "cyberware-chemskin")
      item.summary =
        item.summary.split(" Бонус +2 к Уходу")[0] +
        " Бонус +2 к Уходу за собой требует обеих установок и учитывается один раз.";
    if (item.key === "cyberware-light-tattoo")
      item.summary =
        item.summary.split(" Бонус +2 к Гардеробу")[0] +
        " Бонус +2 к Гардеробу и стилю требует минимум трёх установок и учитывается один раз.";
  }
  return core;
}
