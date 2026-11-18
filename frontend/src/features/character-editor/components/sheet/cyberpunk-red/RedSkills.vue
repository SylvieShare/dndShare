<template>
  <div class="red-stack red-skills" :class="{ 'red-skills--compact': compact, 'red-skills--creation': creation }">
    <section v-if="!creation" class="skill-section">
      <h2>Характеристики</h2>
      <div class="skill-stat-grid">
        <BaseTile v-for="stat in RED_STATS" :key="stat.key" :outlined="false">
          <div class="skill-stat-card" :title="stat.name" :aria-label="stat.name" role="group">
            <ItemIcon :item="media.stat(stat.key)" :size="compact ? 24 : 34" placeholder />
            <div class="skill-stat-name">
              <span>{{ stat.name }}</span>
              <small>{{ stat.key }}</small>
            </div>
            <div v-if="canAdjust" role="group" :aria-label="stat.name">
              <FormNumberInput
                :value="values.stats[stat.key]"
                :min="1"
                :max="20"
                @change="emit('patch', { stats: { ...values.stats, [stat.key]: $event } })"
              />
            </div>
            <strong v-else>{{ stats[stat.key] }}</strong>
          </div>
        </BaseTile>
      </div>
    </section>

    <section class="skill-section">
      <h2 v-if="!creation">Навыки</h2>
      <p v-if="creation" class="skill-hint">База навыка складывается из характеристики и ранга. При проверке к ней прибавляется d10.</p>
      <div class="skill-toolbar skill-filters">
        <FormTextInput v-if="!creation" v-model:value="query" placeholder="Название навыка…" aria-label="Найти навык" />
        <FormSelect v-if="!compact" v-model:value="groupFilter" aria-label="Группа навыков">
          <option value="">Все группы</option>
          <option v-for="(name, key) in RED_SKILL_GROUPS" :key="key" :value="key">{{ name }}</option>
        </FormSelect>
      </div>
      <details v-if="canAdjust && specialized.length" class="skill-specialization-form">
        <summary>Добавить специализацию</summary>
        <p class="skill-hint specialization-hint">
          Например, «Язык — японский» или «Боевые искусства — дзюдо». У каждой специализации свой ранг.
          В игре выбирай её карточку для проверки.
        </p>
        <div class="skill-toolbar">
          <FormSelect :value="selectedSpecialSkill" aria-label="Навык для специализации" @update:value="specialSkill = $event">
            <option v-for="skill in specialized" :key="skill.key" :value="skill.key">{{ skill.name }}</option>
          </FormSelect>
          <FormTextInput v-model:value="specialName" placeholder="Язык, наука, инструмент или стиль" aria-label="Название специализации" />
          <ActionButton :disabled="!specialName.trim() || !selectedSpecialSkill" @click="addSpecial">Добавить</ActionButton>
        </div>
      </details>
      <p v-if="!groups.length" class="skill-hint">Навыки не найдены.</p>
      <section v-for="group in groups" :key="group.key" class="skill-group">
        <h3>{{ group.name }}</h3>
        <div class="skill-card-grid">
          <RedSkillCard
            v-for="row in group.rows"
            :key="row.uid"
            :row="row"
            :art="media"
            :stat-value="stats[row.statKey]"
            :creation="creation"
            :can-adjust="canAdjust"
            @rank="changeRank(row, $event)"
            @remove="removeSkill(row.savedUid)"
            @roll="rollSkill(row)"
          />
        </div>
      </section>
    </section>
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from "vue";
import {
  BaseTile,
  FormNumberInput,
  FormTextInput,
  FormSelect,
  ActionButton,
} from "@sylvieshare/share-ui";
import {
  RED_STATS,
  RED_SKILLS,
  RED_SKILL_GROUPS,
  RED_SKILLS_BY_KEY,
} from "../../../settings/cyberpunk-red/catalogue";
import { redEffectiveStats } from "../../../settings/cyberpunk-red/equipment";
import ItemIcon from "@/features/items/components/ItemIcon.vue";
import { useRedSkillArt } from "../../../composables/useRedSkillArt";
import RedSkillCard from "./RedSkillCard.vue";

const props = defineProps({
  values: Object,
  items: Array,
  editable: Boolean,
  compact: Boolean,
  creation: Boolean,
  allowedKeys: Array,
  art: Object,
});
const emit = defineEmits(["patch", "roll"]);
const localArt = useRedSkillArt();
const media = computed(() => props.art || localArt);
onMounted(() => {
  if (!props.art) void localArt.loadFromSystem().catch(() => {});
});
const canAdjust = computed(() => props.editable && !props.compact);
const query = ref(""),
  groupFilter = ref(""),
  specialSkill = ref("language"),
  specialName = ref("");
const stats = computed(() => redEffectiveStats(props.values, props.items));
const isAllowed = key => !props.allowedKeys || props.allowedKeys.includes(key);
const specialized = computed(() => RED_SKILLS.filter(s => s.specializationKind && isAllowed(s.key)));
const selectedSpecialSkill = computed(() => specialized.value.some(s => s.key === specialSkill.value)
  ? specialSkill.value : specialized.value[0]?.key);
const rows = computed(() =>
  RED_SKILLS.flatMap((skill) => {
    const owned = (props.values.skills || []).filter(
      (s) => s.key === skill.key,
    );
    const outsideRole = !isAllowed(skill.key);
    if (outsideRole && !owned.length) return [];
    return (owned.length ? owned : [{ uid: skill.key, rank: 0 }]).map(
      (entry) => ({
        ...skill,
        ...entry,
        savedUid: owned.length ? entry.uid : null,
        outsideRole,
      }),
    );
  }).filter((s) =>
    (s.name + " " + (s.specialization || ""))
      .toLowerCase()
      .includes(query.value.toLowerCase()),
  ),
);
const groups = computed(() =>
  Object.entries(RED_SKILL_GROUPS)
    .map(([key, name]) => ({
      key,
      name,
      rows: rows.value.filter((s) => s.groupKey === key),
    }))
    .filter(group => group.rows.length && (!groupFilter.value || group.key === groupFilter.value)),
);
function rollSkill(row) {
  emit("roll", {
    kind: "check",
    title: row.specialization ? `${row.name} — ${row.specialization}` : row.name,
    skillKey: row.key,
    skillUid: row.savedUid || "",
    statKey: row.statKey,
  });
}
function changeRank(row, rank) {
  if (row.specializationKind && !row.specialization) return;
  const entries = JSON.parse(JSON.stringify(props.values.skills || [])),
    saved = entries.find((e) => e.uid === row.savedUid);
  if (saved) saved.rank = rank;
  else
    entries.push({
      uid: crypto.randomUUID(),
      key: row.key,
      rank,
      specialization: null,
    });
  emit("patch", { skills: entries });
}
function removeSkill(uid) {
  emit("patch", { skills: props.values.skills.filter(skill => skill.uid !== uid) });
}
function addSpecial() {
  const name = specialName.value.trim();
  const key = selectedSpecialSkill.value;
  if (
    !name || !key ||
    (props.values.skills || []).some(
      (s) =>
        s.key === key &&
        s.specialization?.toLowerCase() === name.toLowerCase(),
    )
  )
    return;
  emit("patch", {
    skills: [
      ...(props.values.skills || []),
      {
        uid: crypto.randomUUID(),
        key,
        rank: 0,
        specialization: name,
      },
    ],
  });
  specialName.value = "";
  if (props.creation && groupFilter.value) groupFilter.value = RED_SKILLS_BY_KEY[key].groupKey;
}
</script>

<style scoped>
.red-skills, .skill-section, .skill-group { display: grid; gap: var(--spacing-medium); min-width: 0; }
.skill-section { gap: var(--spacing-large); }
.skill-section h2, .skill-group h3 { margin: 0; }
.skill-group { padding-block-start: var(--spacing-medium); border-top: 1px solid var(--border); }
.skill-group h3 { font-size: var(--type-row-size); color: var(--text-2); }
.skill-hint { margin: 0; color: var(--text-muted); font-size: var(--type-group-size); }
.skill-toolbar { display: flex; gap: var(--spacing-small); flex-wrap: wrap; align-items: center; }
.skill-toolbar > :first-child { flex: 1 1 230px; min-width: 0; }
.skill-specialization-form summary { color: var(--text-2); cursor: pointer; }
.skill-specialization-form[open] summary { margin-block-end: var(--spacing-small); }
.specialization-hint { margin-block-end: var(--spacing-small); }
.skill-stat-grid, .skill-card-grid { display: grid; gap: var(--spacing-medium); }
.skill-filters > :nth-child(2) { flex: 0 1 200px; width: auto; }
.skill-stat-grid { grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)); }
.skill-card-grid {
  grid-template-columns: repeat(auto-fit, minmax(
    min(100%, max(232px, calc((100% - 2 * var(--spacing-medium)) / 3))), 1fr
  ));
}
.skill-stat-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--spacing-small);
  min-width: 0;
  padding: var(--spacing-small);
}
.skill-stat-name { min-width: 0; }
.skill-stat-name > span, .skill-stat-name > small { display: block; overflow-wrap: anywhere; }
.skill-stat-name > span { font-size: var(--type-group-size); font-weight: 600; }
.skill-stat-name > small { color: var(--text-muted); font-size: var(--type-group-size); }
.skill-stat-card [role="group"] { grid-column: 1 / -1; }
.skill-stat-card strong { font-size: var(--type-row-size); }
.red-skills--compact .skill-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-small); }
.red-skills--compact .skill-card-grid { grid-template-columns: minmax(0, 1fr); }
.red-skills--creation .skill-card-grid {
  grid-template-columns: repeat(auto-fit, minmax(
    min(100%, max(420px, calc((100% - var(--spacing-small)) / 2))), 1fr
  ));
  gap: var(--spacing-small);
}
.red-skills--compact .skill-stat-card { grid-template-columns: auto 1fr; }
.red-skills--compact .skill-stat-name { grid-column: 1 / -1; grid-row: 2; }
.red-skills--compact .skill-stat-card strong { justify-self: end; }
@media (max-width: 599px) {
  .skill-filters > :nth-child(2) { flex: 1 1 200px; }
}
</style>
