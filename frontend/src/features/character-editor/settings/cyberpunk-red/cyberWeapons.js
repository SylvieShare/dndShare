export function redCyberWeaponEntry(implant, item, spaceUid) {
  if (!item.facts.weapon) return null;
  return {
    uid: crypto.randomUUID(),
    key: item.key,
    itemId: item.id || null,
    count: 1,
    equipped: true,
    loaded: 0,
    linkedCyberUid: implant.uid,
    spaceUid,
  };
}

export function redCyberWeaponAvailable(entry, values) {
  if (!entry.linkedCyberUid) return true;
  let implant = values.cyberware.installations.find(
    (i) => i.uid === entry.linkedCyberUid,
  );
  if (!implant) return false;
  const seen = new Set();
  while (implant) {
    if (implant.disabled || seen.has(implant.uid)) return false;
    seen.add(implant.uid);
    implant = values.cyberware.installations.find(
      (i) => i.uid === implant.parentUid,
    );
  }
  return true;
}

export function redBaseWeaponDamage(facts, body, cyberarm = false) {
  if (!["unarmed", "martialArts"].includes(facts?.weaponType))
    return facts?.damage || "";
  let count = body >= 11 ? 4 : body >= 7 ? 3 : body >= 5 ? 2 : 1;
  if (facts.weaponType === "unarmed" && cyberarm) count = Math.max(2, count);
  return count + "d6";
}
