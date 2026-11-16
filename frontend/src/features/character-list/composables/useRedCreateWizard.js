import { computed, ref, watch } from "vue";
import {
  RED_STATS,
  RED_ROLES,
} from "@/features/character-editor/settings/cyberpunk-red/catalogue";
import {
  redInitialSkills,
  redStatsFromRolls,
  validateRedCreation,
} from "@/features/character-editor/settings/cyberpunk-red/creation";
import { RED_STARTING_KITS } from "@/features/character-editor/settings/cyberpunk-red/startingKits";
import {
  finishRedCreation,
  redShoppingSummary,
} from "@/features/character-editor/settings/cyberpunk-red/equipment";
export const RED_CREATE_STEPS = [
  "Правила",
  "Роль",
  "Жизненный путь",
  "Характеристики",
  "Навыки",
  "Снаряжение",
  "Киберимпланты",
  "Завершение",
];
const initial = () => ({
  method: "complete",
  role: "solo",
  name: "",
  nativeLanguage: "Русский",
  homeArea: "Твой дом",
  specializations: { "play-instrument": "Гитара", science: "Биология" },
  roleChoices: {},
  lifepath: {},
  roleLifepath: {},
  stats: Object.fromEntries(
    RED_STATS.map((s) => [s.key, s.key === "REF" ? 8 : 6]),
  ),
  skills: [],
  statRolls: [],
  kitChoices: {},
  cart: [],
});
export function useRedCreateWizard(items) {
  const draft = ref(initial()),
    step = ref(0),
    storageError = ref("");
  const storageKey = "dndshare.red-create.v1";
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (
      saved?.draft?.schemaVersion === 1 &&
      RED_ROLES.some((r) => r.key === saved.draft.role) &&
      ["complete", "streetrat", "edgerunner"].includes(saved.draft.method)
    ) {
      draft.value = { ...initial(), ...saved.draft };
      step.value = Math.min(7, Math.max(0, saved.step || 0));
    }
  } catch {
    storageError.value = "Не удалось восстановить черновик";
  }
  function resetRole() {
    draft.value.skills = redInitialSkills(
      draft.value.role,
      draft.value.method,
      draft.value,
    );
    draft.value.kitChoices = Object.fromEntries(
      RED_STARTING_KITS[draft.value.role]
        .filter((r) => r.choice)
        .map((r) => [r.choice, 0]),
    );
    draft.value.roleChoices =
      draft.value.role === "tech"
        ? { field: 4, upgrade: 2, fabrication: 2, invention: 0 }
        : draft.value.role === "medtech"
          ? {
              surgery: 1,
              pharmaceuticals: 2,
              cryosystem: 1,
              knownRecipes: ["pharma-speedheal", "pharma-rapid-detox"],
            }
          : {};
    if (draft.value.method !== "complete") {
      draft.value.statRolls = Array(
        draft.value.method === "streetrat" ? 1 : 10,
      ).fill(1);
      draft.value.stats = redStatsFromRolls(
        draft.value.role,
        draft.value.method,
        draft.value.statRolls,
      );
    }
  }
  if (!draft.value.skills.length) resetRole();
  watch(
    [draft, step],
    () => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            draft: { ...draft.value, schemaVersion: 1 },
            step: step.value,
          }),
        );
        storageError.value = "";
      } catch {
        storageError.value =
          "Черновик не сохранён на устройстве. Не закрывайте страницу.";
      }
    },
    { deep: true },
  );
  const shopping = computed(() => redShoppingSummary(draft.value, items.value));
  const validation = computed(() => validateRedCreation(draft.value));
  function changeRole(role) {
    draft.value.role = role;
    resetRole();
  }
  function changeMethod(method) {
    draft.value.method = method;
    resetRole();
  }
  function rollStats() {
    draft.value.statRolls = Array.from(
      { length: draft.value.method === "streetrat" ? 1 : 10 },
      () => 1 + Math.floor(Math.random() * 10),
    );
    draft.value.stats = redStatsFromRolls(
      draft.value.role,
      draft.value.method,
      draft.value.statRolls,
    );
  }
  function clearDraft() {
    localStorage.removeItem(storageKey);
  }
  function reset() {
    draft.value = initial();
    step.value = 0;
    resetRole();
  }
  function payload() {
    const result = finishRedCreation(
      JSON.parse(JSON.stringify(draft.value)),
      items.value,
    );
    result.values.lifepath.roleSpecific = { ...draft.value.roleLifepath };
    return result;
  }
  const skillValues = computed(() => ({
    stats: draft.value.stats,
    skills: draft.value.skills,
    humanity: { current: draft.value.stats.EMP * 10 },
    inventory: { entries: [] },
    cyberware: { installations: [] },
  }));
  return {
    draft,
    step,
    shopping,
    validation,
    storageError,
    reset,
    resetRole,
    changeRole,
    changeMethod,
    rollStats,
    clearDraft,
    payload,
    skillValues,
  };
}
