import { redByKey } from "./catalogueItems.js";
import {
  redCyberValidation,
  redCyberRequirement,
  redCyberCapacity,
} from "./cyberware.js";
export { redByKey, redCatalogueItem } from "./catalogueItems.js";
export {
  redCyberValidation,
  redCyberRequirement,
  redCyberCapacity,
} from "./cyberware.js";
import { assembleRedBaseDocument, prepareIncompleteRedDraft } from "./creation.js";
import { RED_KIT_HUMANITY, redKitRows } from "./startingKits.js";
import { redHealthMaximum } from "./derived.js";
import { redCyberWeaponEntry } from "./cyberWeapons.js";
import { redBonuses } from "./effects.js";

export function redFashionEligible(item) {
  return (
    item.kind === "clothing" || item.facts?.cyberCategory === "fashionware"
  );
}
export function redShoppingSummary(draft, items, { equipmentOnly = false } = {}) {
  const byKey = redByKey(items),
    errors = [];
  let general = 0,
    fashion = 0;
  for (const line of draft.cart || []) {
    const item = byKey[line.key];
    if (equipmentOnly && item?.kind === "cyberware") continue;
    if (!item || !Number.isSafeInteger(line.count) || line.count < 1) {
      errors.push("Неизвестный предмет или неверное количество");
      continue;
    }
    if (!["general", "fashion"].includes(line.pool)) {
      errors.push("Выберите бюджет покупки");
      continue;
    }
    const price = Number(item.facts.price),
      quantity = Number(item.facts.quantity) || 1;
    if (!Number.isFinite(price) || price < 0 || quantity <= 0) {
      errors.push("Некорректная цена");
      continue;
    }
    const cost = (price * line.count) / quantity;
    if (line.pool === "fashion") {
      if (draft.method !== "complete" || !redFashionEligible(item))
        errors.push("Этот предмет нельзя оплатить бюджетом одежды");
      fashion += cost;
    } else general += cost;
  }
  const generalLimit = draft.method === "complete" ? 2550 : 500,
    fashionLimit = draft.method === "complete" ? 800 : 0;
  if (general > generalLimit) errors.push("Превышен бюджет снаряжения");
  if (fashion > fashionLimit) errors.push("Превышен бюджет одежды");
  return {
    general,
    fashion,
    generalLimit,
    fashionLimit,
    cash: generalLimit - general,
    errors,
  };
}

export function redEffectiveStats(values, items) {
  const byKey = redByKey(items),
    stats = { ...values.stats },
    installed = (values.cyberware?.installations || []).filter(
      (e) => !e.disabled,
    ),
    bonuses = redBonuses(values, items);
  for (const key of Object.keys(stats))
    if (key !== "BODY")
      stats[key] = Math.max(key === "MOVE" && bonuses["stat:" + key] < 0 ? 1 : 0, stats[key] + (bonuses["stat:" + key] || 0));
  const lace = installed.filter(
    (e) => e.key === "cyberware-grafted-muscle-and-bone-lace",
  ).length;
  if (lace) stats.BODY = Math.min(10, stats.BODY + 2 * lace);
  if (installed.some((e) => e.key === "cyberware-implanted-linear-frame-sigma"))
    stats.BODY = Math.max(stats.BODY, 12);
  if (installed.some((e) => e.key === "cyberware-implanted-linear-frame-beta"))
    stats.BODY = Math.max(stats.BODY, 14);
  const penalty = Math.max(
    0,
    ...(values.inventory?.entries || [])
      .filter((e) => e.equipped && byKey[e.key]?.kind === "armor")
      .map((e) => Math.abs(byKey[e.key].facts.penalty || 0)),
  );
  for (const key of ["REF", "DEX", "MOVE"])
    stats[key] = Math.max(0, stats[key] - penalty);
  stats.EMP = Math.max(
    0,
    Math.min(
      stats.EMP,
      Math.floor((values.humanity?.current ?? stats.EMP * 10) / 10),
    ),
  );
  return stats;
}

function prepareRedStartingGear(draft, items, {
  equipmentOnly = false,
  includeKit = true,
  spaceUid = null,
} = {}) {
  const summary = redShoppingSummary(draft, items, { equipmentOnly });
  if (summary.errors.length) throw new Error(summary.errors[0]);

  const byKey = redByKey(items);
  const include = row => !equipmentOnly || byKey[row.key]?.kind !== "cyberware";
  const gifts = includeKit && draft.method !== "complete"
    ? redKitRows(draft.role, draft.kitChoices, include)
    : [];
  const rows = [
    ...gifts.map(row => ({ ...row, gift: true })),
    ...(draft.cart || []).filter(include),
  ];
  const entries = [];
  const installations = [];
  const netrunning = { deckUid: null, loadedPrograms: [], encounter: null };
  let extraHumanity = 0;
  for (const row of rows) {
    const item = byKey[row.key];
    if (!item) throw new Error(`В справочнике отсутствует ${row.key}`);
    if (item.kind === "cyberware") {
      for (let i = 0; i < row.count; i++) {
        installations.push({
          uid: crypto.randomUUID(),
          key: item.key,
          itemId: item.id || null,
          parentUid: null,
          location: row.location || "",
          gift: !!row.gift,
        });
        if (!row.gift) extraHumanity += Number(item.facts.humanity || 0);
      }
    } else
      entries.push({
        uid: crypto.randomUUID(),
        key: item.key,
        itemId: item.id || null,
        count: row.count,
        spaceUid,
        equipped: ["weapon", "armor", "cyberdeck"].includes(item.kind),
        loaded: 0,
        ablation: { head: 0, body: 0 },
        gift: !!row.gift,
      });
  }
  for (const entry of installations) {
    const req = redCyberRequirement(byKey[entry.key]);
    if (req && !req.startsWith("flesh-")) {
      const size = Number(byKey[entry.key].facts.size ?? 1);
      const parent = installations.find(
        (e) =>
          e.key === req &&
          installations
            .filter((child) => child.parentUid === e.uid)
            .reduce(
              (n, child) => n + Number(byKey[child.key]?.facts.size ?? 1),
              0,
            ) +
            size <=
            redCyberCapacity(e, installations, byKey),
      );
      entry.parentUid = parent?.uid || null;
    }
    if (req?.startsWith("flesh-")) {
      const parentKey =
        req === "flesh-arm" ? "cyberware-cyberarm" : "cyberware-cyberleg";
      entry.parentUid =
        installations.find((e) => e.key === parentKey)?.uid || null;
      if (!entry.parentUid) entry.location = entry.location || `${req}-left`;
    }
  }
  const cyberCheck = redCyberValidation(
    installations,
    items,
    draft.stats,
  );
  if (cyberCheck.errors.length) throw new Error(cyberCheck.errors.join("; "));
  const humanity = draft.stats.EMP * 10 - extraHumanity -
    (equipmentOnly || !includeKit || draft.method === "complete" ? 0 : RED_KIT_HUMANITY[draft.role]);
  if (humanity < 0) throw new Error("Потеря человечности превышает начальный запас");
  const deck = entries.find(
    (e) => byKey[e.key]?.kind === "cyberdeck",
  );
  if (deck) {
    netrunning.deckUid = deck.uid;
    netrunning.loadedPrograms = entries
      .filter((e) => byKey[e.key]?.kind === "program")
      .flatMap((e) =>
        Array.from({ length: e.count }, () => ({
          uid: crypto.randomUUID(),
          entryUid: e.uid,
          key: e.key,
          active: false,
          rez: byKey[e.key].facts.rez,
        })),
      );
    const used = netrunning.loadedPrograms.reduce(
      (n, p) => n + Number(byKey[p.key]?.facts.size || 1),
      0,
    );
    if (used > byKey[deck.key].facts.slots)
      throw new Error("Программы не помещаются в кибердеку");
  }
  for (const implant of installations) {
    const weapon = redCyberWeaponEntry(
      implant,
      byKey[implant.key],
      spaceUid,
    );
    if (weapon) entries.push(weapon);
  }
  return { entries, installations, netrunning, humanity, cash: summary.cash };
}

export function redStartingGearError(draft, items, { equipmentOnly = false } = {}) {
  try {
    prepareRedStartingGear(draft, items, { equipmentOnly });
    return "";
  } catch (error) {
    return error.message;
  }
}

function incompleteStartingGear(draft, items, spaceUid) {
  const attempts = [
    [draft, { spaceUid }],
    [draft, { spaceUid, equipmentOnly: true }],
    [{ ...draft, cart: [] }, { spaceUid }],
    [{ ...draft, cart: [] }, { spaceUid, includeKit: false }],
  ];
  for (const [candidate, options] of attempts) {
    try {
      return prepareRedStartingGear(candidate, items, options);
    } catch {
      // Keep the first usable selection and leave the rest for the sheet.
    }
  }
  throw new Error("Не удалось собрать стартовое снаряжение RED");
}

export function finishRedCreation(draft, items, { incomplete = false } = {}) {
  if (incomplete) draft = prepareIncompleteRedDraft(draft);
  const doc = assembleRedBaseDocument(draft, { incomplete });
  const v = doc.values;
  const spaceUid = v.inventory.spaces[0].uid;
  const gear = incomplete
    ? incompleteStartingGear(draft, items, spaceUid)
    : prepareRedStartingGear(draft, items, { spaceUid });
  v.inventory.entries = gear.entries;
  v.cyberware.installations = gear.installations;
  v.netrunning = gear.netrunning;
  v.humanity.current = gear.humanity;
  v.economy.cashEb = gear.cash;
  const effective = redEffectiveStats(v, items);
  v.health.current = redHealthMaximum(effective.BODY, effective.WILL);
  v.creation.complete = !incomplete;
  const byKey = redByKey(items);
  for (const key of ["weapon-unarmed", "weapon-martial-arts"])
    if (byKey[key])
      v.inventory.entries.push({
        uid: crypto.randomUUID(),
        key,
        itemId: byKey[key].id,
        count: 1,
        equipped: true,
        spaceUid: v.inventory.spaces[0].uid,
      });
  return doc;
}

// An EMP-disabled implanted frame still contributes to maximum HP (official FAQ).
export function redMaximumHealth(values, items = []) {
  const healthValues = {
    ...values,
    cyberware: {
      ...values.cyberware,
      installations: (values.cyberware?.installations || []).map((e) =>
        e.key.startsWith("cyberware-implanted-linear-frame-")
          ? { ...e, disabled: false }
          : e,
      ),
    },
  };
  const stats = redEffectiveStats(healthValues, items);
  return redHealthMaximum(stats.BODY, Math.max(1, stats.WILL));
}
