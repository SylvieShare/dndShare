import {
  pvAvatar,
  pvName,
  pvHp,
  pvAc,
} from "@/features/sessions/lib/participantView";
export function sessionCreatures(participants, encounter) {
  const combatants = encounter?.encounter?.combatants || [];
  return [
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
        ref: n.uid,
        name: `${n.markerLetter ? n.markerLetter + " · " : ""}${encounter.npcName(n)}`,
        previewUrl: encounter.npcItem(n)?.iconImageUrl || "",
        color: n.iconColor || "#c18f6f",
        hp: encounter.npcHpObj?.(n) || {
          current: n.hpCurrent ?? 0,
          max: encounter.npcHpMax?.(n) || 0,
          temp: n.hpTemp || 0,
        },
        combatant: n,
      })),
  ];
}
export const creatureKey = (c) => (c ? `${c.kind}:${c.ref || c.id}` : "");
export function creatureToken(map, creature) {
  return map?.state.tokens.find(
    (t) => creatureKey(t) === creatureKey(creature),
  );
}
