import {
  pvAvatar,
  pvName,
  pvHp,
  pvAc,
} from "@/features/sessions/lib/participantView";
export function creaturePortraitUrl(item) {
  return (
    item?.iconImageUrl || (item?.iconSvgId ? `/api/svg/${item.iconSvgId}` : "")
  );
}
export function withCreaturePortraits(tokens, candidates) {
  const portraits = new Map(
    candidates.map((c) => [creatureKey(c), c.previewUrl]),
  );
  return tokens.map((t) =>
    !t.imageUrl && portraits.get(creatureKey(t))
      ? { ...t, imageUrl: portraits.get(creatureKey(t)) }
      : t,
  );
}
export function sessionCreatures(participants, encounter) {
  const combatants = encounter?.encounter?.combatants || [];
  const candidates = [
    ...participants.map((p) => ({
      kind: "player",
      ref: String(p.charId),
      name: pvName(p) || "Персонаж",
      previewUrl: pvAvatar(p) || "",
      color: p.color || "#a797d4",
      hp: pvHp(p),
      ac: pvAc(p),
      participant: p,
      combatant: combatants.find(
        (c) => c.type === "player" && String(c.charId) === String(p.charId),
      ),
    })),
    ...combatants
      .filter((n) => n.type === "npc")
      .map((n) => ({
        kind: "creature",
        itemId: n.itemId,
        ref: n.uid,
        name: encounter.npcName(n),
        markerLetter: n.markerLetter,
        previewUrl: creaturePortraitUrl(encounter.npcItem(n)),
        color: n.iconColor || "#c18f6f",
        hp: encounter.npcHpObj?.(n) || {
          current: n.hpCurrent ?? 0,
          max: encounter.npcHpMax?.(n) || 0,
          temp: n.hpTemp || 0,
        },
        combatant: n,
      })),
  ];
  return candidates.map(c => ({ ...c, dead: c.combatant?.position === "dead" }));
}
export const creatureKey = (c) => (c ? `${c.kind}:${c.ref || c.id}` : "");
export function creatureToken(map, creature) {
  return map?.state.tokens.find(
    (t) => creatureKey(t) === creatureKey(creature),
  );
}

// Read-only rendering enrichment: opening a map never saves inferred item IDs.
export function withCreatureItems(tokens, candidates) {
  const items = new Map(
    candidates
      .filter((c) => c.kind === "creature")
      .map((c) => [creatureKey(c), c.itemId]),
  );
  return tokens.map((t) =>
    !t.itemId && items.get(creatureKey(t))
      ? { ...t, itemId: items.get(creatureKey(t)) }
      : t,
  );
}

// Encounter owns life state; map drafts keep only placement and appearance.
export function withCreatureLifeState(tokens, candidates) {
  const dead = new Map(candidates.map(c => [creatureKey(c), c.dead]));
  return tokens.map(t => ({ ...t, dead: !!dead.get(creatureKey(t)) }));
}
