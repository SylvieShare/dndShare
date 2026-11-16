import { redByKey } from "./catalogueItems.js";
const fleshArm = new Set([
  "big-knucks",
  "standard-hand",
  "rippers",
  "scratchers",
  "slice-n-dice",
  "subdermal-grip",
  "tool-hand",
  "wolvers",
]);
const fleshLeg = new Set(["standard-foot", "talon-foot"]);
const baseFor = {
  neuralWare: "cyberware-neural-link",
  cyberEye: "cyberware-cybereye",
  cyberOptics: "cyberware-cybereye",
  cyberAudioSuite: "cyberware-cyberaudio-suite",
  cyberArm: "cyberware-cyberarm",
  cyberLeg: "cyberware-cyberleg",
};
export function redCyberRequirement(item) {
  const f = item.facts || {},
    key = item.key.replace("cyberware-", "");
  if (f.foundation) return null;
  if (
    [
      "chemical-analyzer",
      "olfactory-boost",
      "pain-editor",
      "tactile-boost",
      "skill-chip",
      "difficult-skill-chip",
      "memory-chip",
    ].includes(key)
  )
    return "cyberware-chipware-socket";
  if (key === "sensor-array") return "cyberware-cyberaudio-suite";
  if (f.cyberCategory === "cyberArm" && fleshArm.has(key)) return "flesh-arm";
  if (f.cyberCategory === "cyberLeg" && fleshLeg.has(key)) return "flesh-leg";
  return baseFor[f.cyberCategory] || null;
}
export function redCyberCapacity(entry, installations, items) {
  const byKey = Array.isArray(items) ? redByKey(items) : items;
  return (
    Number(byKey[entry.key]?.facts.slots || 0) +
    (entry.key === "cyberware-cyberaudio-suite" &&
    installations.some((e) => e.key === "cyberware-sensor-array")
      ? 5
      : 0)
  );
}

export function redCyberValidation(installations, items, stats) {
  const byKey = redByKey(items),
    errors = [],
    used = new Map(),
    categoryCount = {};
  for (const entry of installations) {
    const item = byKey[entry.key];
    if (!item) {
      errors.push("Неизвестный имплант");
      continue;
    }
    const req = redCyberRequirement(item),
      parent = installations.find((e) => e.uid === entry.parentUid);
    if (req && !req.startsWith("flesh-")) {
      if (
        !parent ||
        byKey[parent.key]?.key !== req ||
        parent.uid === entry.uid
      ) {
        errors.push(`${item.name}: требуется основная установка`);
        continue;
      }
    }
    if (parent) {
      if (!redCyberCapacity(parent, installations, byKey))
        errors.push(`${item.name}: недопустимое основание`);
      if (
        req?.startsWith("flesh-") &&
        !["cyberware-cyberarm", "cyberware-cyberleg"].includes(parent.key)
      )
        errors.push(`${item.name}: несовместимая конечность`);
      used.set(
        parent.uid,
        (used.get(parent.uid) || 0) + Number(item.facts.size || 0),
      );
    }
    if (!parent && req?.startsWith("flesh-")) {
      const location = entry.location || req;
      const count = (categoryCount[location] || 0) + 1;
      categoryCount[location] = count;
      if (count > 1)
        errors.push(`${item.name}: одна опция на органическую конечность`);
    }
    const cat = item.facts.cyberCategory;
    if (
      ["fashionware", "cyberwareInternal", "cyberwareExternal"].includes(cat)
    ) {
      categoryCount[cat] =
        (categoryCount[cat] || 0) + Number(item.facts.size ?? 1);
      if (categoryCount[cat] > 7)
        errors.push(`${item.name}: превышено 7 слотов категории`);
    }
  }
  for (const entry of installations) {
    if (
      (used.get(entry.uid) || 0) > redCyberCapacity(entry, installations, byKey)
    )
      errors.push("Не хватает слотов в основной установке");
  }
  if (
    installations.filter((e) =>
      ["cyberware-kerenzikov", "cyberware-sandevistan"].includes(e.key),
    ).length > 1
  )
    errors.push("Можно установить только один вариант Speedware");
  const lace = installations.filter(
    (e) => e.key === "cyberware-grafted-muscle-and-bone-lace",
  ).length;
  const limits = {
    "cyberware-neural-link": 1,
    "cyberware-cyberaudio-suite": 1,
    "cyberware-sensor-array": 1,
    "cyberware-multioptic-mount": 1,
    "cyberware-artificial-shoulder-mount": 1,
    "cyberware-cybereye":
      2 +
      (installations.some((e) => e.key === "cyberware-multioptic-mount")
        ? 5
        : 0),
    "cyberware-cyberarm":
      2 +
      (installations.some(
        (e) => e.key === "cyberware-artificial-shoulder-mount",
      )
        ? 2
        : 0),
    "cyberware-cyberleg": 2,
  };
  for (const [key, limit] of Object.entries(limits))
    if (installations.filter((e) => e.key === key).length > limit)
      errors.push(`${byKey[key]?.name || key}: превышено количество установок`);
  for (const e of installations) {
    const augmentedBody = Math.min(10, stats.BODY + lace * 2);
    if (
      e.key === "cyberware-implanted-linear-frame-sigma" &&
      (augmentedBody < 6 || lace < 1)
    )
      errors.push("Экзоскелет Sigma требует BODY 6 и усиление мышц/костей");
    if (
      e.key === "cyberware-implanted-linear-frame-beta" &&
      (augmentedBody < 8 || lace < 2)
    )
      errors.push("Экзоскелет Beta требует BODY 8 и два усиления мышц/костей");
  }
  if (
    installations.filter((e) =>
      e.key.startsWith("cyberware-implanted-linear-frame-"),
    ).length > 1
  )
    errors.push("Допускается один имплантированный экзоскелет");
  for (const entry of installations) {
    const seen = new Set([entry.uid]);
    let parent = entry.parentUid;
    while (parent) {
      if (seen.has(parent)) {
        errors.push("Циклическая установка имплантов");
        break;
      }
      seen.add(parent);
      parent = installations.find((e) => e.uid === parent)?.parentUid;
    }
  }
  return { errors, used: Object.fromEntries(used) };
}
