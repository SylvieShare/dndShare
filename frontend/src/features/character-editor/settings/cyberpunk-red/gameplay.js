import { RED_SKILLS_BY_KEY, RED_ROLES } from "./catalogue.js";
import { redByKey, redEffectiveStats, redMaximumHealth } from "./equipment.js";
export const cloneRed = (value) => JSON.parse(JSON.stringify(value));
const integer = (n, min = 0, max = 100000) => {
  if (!Number.isSafeInteger(n) || n < min || n > max)
    throw new RangeError("Недопустимое число");
  return n;
};
export function redArmor(values, items, location = "body") {
  const byKey = redByKey(items),
    key = location === "head" ? "headSP" : "bodySP";
  const layers = (values.inventory.entries || [])
    .filter((e) => e.equipped && byKey[e.key]?.facts[key] > 0)
    .map((e) => ({
      uid: e.uid,
      sp: Math.max(0, byKey[e.key].facts[key] - (e.ablation?.[location] || 0)),
    }));
  for (const e of values.cyberware.installations || []) {
    if (["cyberware-skin-weave", "cyberware-subdermal-armor"].includes(e.key))
      layers.push({
        uid: e.uid,
        sp: Math.max(
          0,
          (e.key.includes("skin-weave") ? 7 : 11) -
            (e.ablation?.[location] || 0),
        ),
        implant: true,
      });
  }
  return { sp: Math.max(0, ...layers.map((e) => e.sp)), layers };
}
export function redDamage(
  values,
  items,
  {
    damage,
    location = "body",
    armorMode = "full",
    critical = false,
    ablation = 1,
    nonlethal = false,
    ignoreSPBelow = 0,
    ablationOnly = false,
  },
) {
  integer(damage);
  integer(ablation, 0, 10);
  if (
    !["head", "body"].includes(location) ||
    !["full", "half", "ignore"].includes(armorMode)
  )
    throw new Error("Неверный тип попадания");
  const next = cloneRed(values),
    armor = redArmor(values, items, location);
  const protection =
    armorMode === "ignore" || ignoreSPBelow > armor.sp
      ? 0
      : armorMode === "half"
        ? Math.ceil(armor.sp / 2)
        : armor.sp;
  const solo = values.roles?.find((r) => r.key === "solo")?.choices || {};
  if (
    !values.combat?.damageDeflectionUsed &&
    armorMode !== "ignore" &&
    damage > 0 &&
    (solo.damageDeflection || 0) > 0
  ) {
    damage = Math.max(0, damage - solo.damageDeflection);
    next.combat = { ...next.combat, damageDeflectionUsed: true };
  }
  const headMultiplier = values.health.injuries?.some(
    (e) => e.key === "criticalinjury-cracked-skull",
  )
    ? 3
    : 2;
  const penetrating = Math.max(0, damage - protection),
    hpLoss =
      penetrating * (location === "head" ? headMultiplier : 1) +
      (critical && !nonlethal ? 5 : 0);
  const wasMortal = next.health.current <= 0;
  next.health.current = Math.max(
    nonlethal ? Math.min(1, next.health.current) : 0,
    next.health.current - hpLoss,
  );
  if (hpLoss > 0) next.health.stabilized = false;
  if (wasMortal && hpLoss > 0)
    next.health.deathSavePenalty = (next.health.deathSavePenalty || 0) + 1;
  if ((penetrating > 0 || ablationOnly) && armorMode !== "ignore" && !nonlethal)
    for (const layer of armor.layers) {
      const entry = (
        layer.implant ? next.cyberware.installations : next.inventory.entries
      ).find((e) => e.uid === layer.uid);
      entry.ablation = {
        ...entry.ablation,
        [location]: (entry.ablation?.[location] || 0) + ablation,
      };
    }
  return {
    next,
    hpLoss,
    protection,
    penetrating,
    critical: !nonlethal && (critical || (wasMortal && hpLoss > 0)),
    ablation:
      (penetrating > 0 || ablationOnly) && armorMode !== "ignore" && !nonlethal
        ? ablation
        : 0,
  };
}
export function redAdvance(values, { kind, uid, key }) {
  const next = cloneRed(values);
  let cost = 0,
    name = "";
  if (kind === "skill") {
    const entry = next.skills.find((s) => s.uid === uid),
      skill = RED_SKILLS_BY_KEY[entry?.key];
    if (!entry || !skill || entry.rank >= 10)
      throw new Error("Навык уже максимален или не найден");
    cost = (entry.rank + 1) * 20 * skill.costMultiplier;
    name = skill.name;
    if (next.progression.ipAvailable < cost)
      throw new Error(`Не хватает IP: требуется ${cost}`);
    entry.rank++;
  } else if (kind === "role") {
    const role = next.roles.find((r) => r.uid === uid);
    if (role) {
      if (role.rank >= 10) throw new Error("Максимальный ранг");
      cost = (role.rank + 1) * 60;
      name = role.key;
      if (next.progression.ipAvailable < cost)
        throw new Error(`Не хватает IP: требуется ${cost}`);
      role.rank++;
    } else {
      if (
        !RED_ROLES.some((r) => r.key === key) ||
        next.roles.some((r) => r.key === key)
      )
        throw new Error("Роль уже есть или неизвестна");
      if (next.roles.at(-1)?.rank < 4)
        throw new Error("Последнюю роль нужно развить до ранга 4");
      cost = 60;
      name = key;
      if (next.progression.ipAvailable < cost)
        throw new Error("Для новой роли нужно 60 IP");
      next.roles.push({ uid: crypto.randomUUID(), key, rank: 1, choices: {} });
    }
  } else throw new Error("Неизвестное развитие");
  next.progression.ipAvailable -= cost;
  next.progression.ipSpent += cost;
  next.progression.transactions.push({
    uid: crypto.randomUUID(),
    at: new Date().toISOString(),
    name,
    cost,
    kind,
  });
  return next;
}
export function redNewSession(values) {
  const next = cloneRed(values);
  next.luck.current = next.stats.LUCK;
  return next;
}
export function redNetActions(rank) {
  integer(rank, 0, 10);
  return rank === 0 ? 0 : rank === 10 ? 5 : 2 + Math.floor((rank - 1) / 3);
}
export function redHeal(values, items, days) {
  integer(days, 1, 365);
  if (
    values.health.dead ||
    values.health.current <= 0 ||
    !values.health.stabilized
  )
    throw new Error("Сначала стабилизируйте живого персонажа");
  const next = cloneRed(values),
    stats = redEffectiveStats(values, items),
    antibiotic = values.health.conditions?.some(
      (c) => c.key === "pharma-antibiotic",
    )
      ? 2
      : 0;
  next.health.current = Math.min(
    redMaximumHealth(values, items),
    values.health.current +
      (stats.BODY *
        (values.cyberware.installations.some(
          (e) => e.key === "cyberware-enhanced-antibodies" && !e.disabled,
        )
          ? 2
          : 1) +
        antibiotic) *
        days,
  );
  next.health.medicineUsed = (next.health.medicineUsed || []).filter(
    (k) => k === "pharma-surge",
  );
  return next;
}
export function redSoloAllocation(rank, choices) {
  const costs = {
    damageDeflection: 2,
    fumbleRecovery: 4,
    initiative: 1,
    precisionAttack: 3,
    spotWeakness: 1,
    threatDetection: 1,
  };
  let spent = 0;
  for (const [key, cost] of Object.entries(costs)) {
    const value = choices[key] || 0;
    integer(value, 0, key === "fumbleRecovery" ? 1 : 10);
    spent += value * cost;
  }
  if (spent > rank)
    throw new Error("Распределено больше очков боевого чутья, чем ранг Соло");
  return { spent, remaining: rank - spent };
}
