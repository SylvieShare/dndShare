// Core pp. 150, 357–358. Primary and addiction effects have different lifecycles.
export function correctDrugs(core) {
  const social = [
    "acting",
    "contortionist",
    "conversation",
    "dance",
    "human-perception",
    "persuasion",
  ];
  const rows = {
    "black-lace": {
      hours: 24,
      addictionDV: 17,
      summary:
        "При приёме теряется 2d6 Humanity, штраф тяжёлого ранения игнорируется. После окончания пройдите Resist Torture/Drugs DV 17: при успехе Humanity возвращается; иначе развивается зависимость, и вне действия препарата REF −2.",
      bonuses: [
        ["pain-suppression", 1, "primary"],
        ["stat:REF", -2, "secondary"],
      ],
    },
    "blue-glass": {
      hours: 4,
      addictionDV: 15,
      summary:
        "Ведущий назначает галлюцинации, во время которых теряется действие. После окончания Resist Torture/Drugs DV 15 определяет зависимость; при зависимости приступы возникают и без новой дозы.",
      bonuses: [],
    },
    boost: {
      hours: 24,
      addictionDV: 17,
      summary:
        "На 24 часа INT +2. По окончании Resist Torture/Drugs DV 17: при провале зависимость и INT −2 до лечения.",
      bonuses: [
        ["stat:INT", 2, "primary"],
        ["stat:INT", -2, "secondary"],
      ],
    },
    smash: {
      hours: 4,
      addictionDV: 15,
      summary:
        "На 4 часа +2 к шести социальным/исполнительским навыкам. По окончании Resist Torture/Drugs DV 15: при провале зависимость и −2 к тем же навыкам до лечения.",
      bonuses: [
        ...social.map((t) => [t, 2, "primary"]),
        ...social.map((t) => [t, -2, "secondary"]),
      ],
    },
    synthcoke: {
      hours: 4,
      addictionDV: 15,
      summary:
        "На 4 часа REF +1 и паранойя по решению ведущего. По окончании Resist Torture/Drugs DV 15: при провале зависимость и REF −2 до лечения.",
      bonuses: [
        ["stat:REF", 1, "primary"],
        ["stat:REF", -2, "secondary"],
      ],
    },
  };
  // Pharmaceutical entries have their own type and must not be duplicated as free street drugs.
  core.items = core.items.filter(
    (i) => i.kind !== "drug" || rows[i.key.replace("drug-", "")],
  );
  for (const i of core.items) {
    const row = rows[i.key.replace("drug-", "")];
    if (i.kind !== "drug" || !row) continue;
    i.summary = row.summary;
    i.facts = {
      ...i.facts,
      hours: row.hours,
      addictionDV: row.addictionDV,
      bonuses: row.bonuses.map(([target, value, phase]) => ({
        target,
        value,
        phase,
      })),
    };
  }
}
