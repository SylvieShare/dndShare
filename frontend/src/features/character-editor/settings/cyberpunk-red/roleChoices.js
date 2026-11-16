export const redInitialRoleChoices = (key) =>
  key === "tech"
    ? { field: 4, upgrade: 2, fabrication: 2, invention: 0 }
    : key === "medtech"
      ? {
          surgery: 1,
          pharmaceuticals: 2,
          cryosystem: 1,
          knownRecipes: ["pharma-speedheal", "pharma-rapid-detox"],
        }
      : {};
export function redRoleChoiceErrors(key, rank, choices) {
  const costs =
    key === "solo"
      ? {
          damageDeflection: 2,
          fumbleRecovery: 4,
          initiative: 1,
          precisionAttack: 3,
          spotWeakness: 1,
          threatDetection: 1,
        }
      : key === "tech"
        ? { field: 1, upgrade: 1, fabrication: 1, invention: 1 }
        : key === "medtech"
          ? { surgery: 1, pharmaceuticals: 1, cryosystem: 1 }
          : {};
  const errors = [],
    limit = rank * (key === "tech" ? 2 : 1);
  let total = 0;
  for (const [field, cost] of Object.entries(costs)) {
    const n = choices?.[field] || 0,
      max = field === "fumbleRecovery" ? 1 : key === "medtech" ? 5 : rank;
    if (!Number.isSafeInteger(n) || n < 0 || n > max)
      errors.push("role-choice-range");
    total += n * cost;
  }
  if (total > limit) errors.push("role-choice-budget");
  if (
    key === "medtech" &&
    (choices?.knownRecipes || []).length > (choices?.pharmaceuticals || 0)
  )
    errors.push("recipe-budget");
  return [...new Set(errors)];
}
