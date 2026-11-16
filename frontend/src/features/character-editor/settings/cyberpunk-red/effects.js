const copy = (value) => JSON.parse(JSON.stringify(value));

export function redBonuses(values, items, { initiative = false } = {}) {
  const byKey = Object.fromEntries(items.map((i) => [i.key, i])),
    seen = new Map();
  const installed = (values.cyberware?.installations || []).filter(
    (e) => !e.disabled,
  );
  const entries = [
    ...(values.inventory?.entries || []).filter((e) => e.equipped),
    ...installed,
    ...(initiative ? [] : values.health?.injuries || []),
    ...(values.health?.conditions || []),
  ];
  for (const e of entries) {
    if (e.disabled || (e.key === "cyberware-sandevistan" && !e.active))
      continue;
    if (
      e.key === "drug-black-lace" &&
      e.phase === "secondary" &&
      entries.some((c) => c.key === e.key && c.phase === "primary")
    )
      continue;
    if (
      e.key === "cyberware-chemskin" ||
      (e.key === "cyberware-techhair" &&
        !installed.some((i) => i.key === "cyberware-chemskin")) ||
      (e.key === "cyberware-light-tattoo" &&
        installed.filter((i) => i.key === e.key).length < 3)
    )
      continue;
    const f = byKey[e.key]?.facts || {};
    if (f.programClass) continue;
    if (
      f.paired &&
      new Set(
        installed
          .filter((i) => i.key === e.key)
          .map((i) => i.parentUid)
          .filter(Boolean),
      ).size < 2
    )
      continue;
    for (const b of [...(f.bonuses || []), ...(e.bonuses || [])]) {
      if (
        (b.phase && b.phase !== e.phase) ||
        (b.conditional && !e.enabledBonuses?.includes(b.target))
      )
        continue;
      const key =
          (e.key || e.uid) + (b.phase ? "@" + b.phase : "") + "|" + b.target,
        previous = seen.get(key);
      if (previous == null || b.value > previous) seen.set(key, b.value);
    }
  }
  const totals = {};
  for (const [key, value] of seen) {
    const target = key.split("|")[1];
    totals[target] = (totals[target] || 0) + value;
  }
  return totals;
}

export function redUseConsumable(
  values,
  item,
  entryUid,
  {
    medtech = false,
    roll = (sides) => 1 + Math.floor(Math.random() * sides),
  } = {},
) {
  const next = copy(values),
    entry = next.inventory.entries.find((e) => e.uid === entryUid);
  if (!entry || entry.count < 1) throw new Error("Нет дозы в инвентаре");
  if (next.health.dead) throw new Error("Персонаж погиб");
  const conditions = next.health.conditions || [],
    key = item.key;
  if (item.kind === "drug") {
    if (conditions.some((c) => c.key === key && c.phase === "primary"))
      throw new Error("Первичный эффект уже действует");
    const loss = key === "drug-black-lace" ? roll(6) + roll(6) : 0;
    next.humanity.current -= loss;
    conditions.push({
      uid: crypto.randomUUID(),
      key,
      name: item.name,
      phase: "primary",
      humanityLoss: loss,
      duration: `${item.facts.hours} ч.`,
      bonuses: [],
    });
  } else if (item.kind === "pharmaceutical") {
    if (!medtech)
      throw new Error("Введение препарата должен выполнить Медтехник");
    const used = next.health.medicineUsed || [];
    if (used.includes(key))
      throw new Error(
        "Этот препарат уже использован за текущий период; дождитесь следующего дня/недели",
      );
    if (key === "pharma-speedheal") {
      if (next.health.current <= 0)
        throw new Error("Спидхил не помогает при смертельном ранении");
      // Caller caps at derived HP, including implanted frames.
      next.health.current += values.stats.BODY + values.stats.WILL;
    } else if (key === "pharma-rapid-detox") {
      for (const c of conditions.filter(
        (c) => c.phase === "primary" && c.key?.startsWith("drug-"),
      ))
        next.humanity.current += c.humanityLoss || 0;
      next.health.conditions = conditions.filter(
        (c) => !(c.phase === "primary" && c.key?.startsWith("drug-")),
      );
    } else if (!conditions.some((c) => c.key === key)) {
      conditions.push({
        uid: crypto.randomUUID(),
        key,
        name: item.name,
        duration:
          key === "pharma-antibiotic"
            ? "7 дней"
            : key === "pharma-stim"
              ? "1 час"
              : "24 часа",
        bonuses:
          key === "pharma-stim"
            ? [{ target: "pain-suppression", value: 1 }]
            : [],
      });
    }
    if (["pharma-speedheal", "pharma-stim", "pharma-surge"].includes(key))
      next.health.medicineUsed = [...used, key];
  } else throw new Error("Это не препарат");
  if (!next.health.conditions || key !== "pharma-rapid-detox")
    next.health.conditions = conditions;
  entry.count--;
  return next;
}

export function redEndDrug(values, uid, success) {
  const next = copy(values),
    c = next.health.conditions.find((e) => e.uid === uid);
  if (!c) throw new Error("Эффект не найден");
  if (c.key === "drug-black-lace" && success)
    next.humanity.current += c.humanityLoss || 0;
  next.health.conditions = next.health.conditions.filter((e) => e.uid !== uid);
  if (
    !success &&
    !next.health.conditions.some(
      (e) => e.key === c.key && e.phase === "secondary",
    )
  )
    next.health.conditions.push({
      uid: crypto.randomUUID(),
      key: c.key,
      name: c.name,
      phase: "secondary",
      duration: "До лечения зависимости",
    });
  return next;
}
