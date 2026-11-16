<template>
  <div class="red-stack">
    <BaseTile :outlined="false"
      ><div class="red-panel">
        <h2>Характеристики</h2>
        <div class="red-stat-grid">
          <FormField
            v-for="s in RED_STATS"
            :key="s.key"
            :label="`${s.name} · ${s.key}`"
            vertical
            ><FormNumberInput
              v-if="editable && !compact && !creation"
              :value="values.stats[s.key]"
              :min="1"
              :max="20"
              @change="
                emit('patch', { stats: { ...values.stats, [s.key]: $event } })
              "
            /><strong v-else>{{ stats[s.key] }}</strong></FormField
          >
        </div>
      </div></BaseTile
    >
    <BaseTile :outlined="false"
      ><div class="red-panel">
        <h2>Навыки</h2>
        <FormTextInput
          v-model:value="query"
          placeholder="Название навыка…"
          aria-label="Найти навык"
        />
        <div v-for="group in groups" :key="group.key">
          <h3>{{ group.name }}</h3>
          <div v-for="row in group.rows" :key="row.uid" class="red-skill-row">
            <div>
              <span>{{ row.name }}</span
              ><small
                >{{ row.specialization || row.statKey }} · ранг {{ row.rank
                }}{{ row.costMultiplier === 2 ? " · ×2" : "" }}</small
              >
            </div>
            <FormNumberInput
              v-if="editable && !compact"
              :value="row.rank"
              :min="0"
              :max="10"
              @change="changeRank(row, $event)"
            />
            <strong v-if="creation">{{ stats[row.statKey] + row.rank }}</strong
            ><ActionButton
              v-else
              :aria-label="`Бросить ${row.name}`"
              @click="
                emit('roll', {
                  kind: 'check',
                  title: row.name,
                  skillKey: row.key,
                  skillUid: row.savedUid || '',
                  statKey: row.statKey,
                })
              "
              >{{ stats[row.statKey] + row.rank }}</ActionButton
            >
          </div>
        </div>
        <div v-if="editable && !compact" class="red-section">
          <h3>Новая специализация</h3>
          <FormSelect v-model:value="specialSkill"
            ><option v-for="s in specialized" :key="s.key" :value="s.key">
              {{ s.name }}
            </option></FormSelect
          ><FormTextInput
            v-model:value="specialName"
            placeholder="Язык, наука, инструмент или стиль"
            aria-label="Название специализации"
          /><ActionButton :disabled="!specialName.trim()" @click="addSpecial"
            >Добавить</ActionButton
          >
        </div>
      </div></BaseTile
    >
  </div>
</template>
<script setup>
import { computed, ref } from "vue";
import {
  BaseTile,
  FormField,
  FormNumberInput,
  FormTextInput,
  FormSelect,
  ActionButton,
} from "@sylvieshare/share-ui";
import {
  RED_STATS,
  RED_SKILLS,
  RED_SKILL_GROUPS,
} from "../../../settings/cyberpunk-red/catalogue";
import { redEffectiveStats } from "../../../settings/cyberpunk-red/equipment";
const props = defineProps({
  values: Object,
  items: Array,
  editable: Boolean,
  compact: Boolean,
  creation: Boolean,
});
const emit = defineEmits(["patch", "roll"]);
const query = ref(""),
  specialSkill = ref("language"),
  specialName = ref("");
const stats = computed(() => redEffectiveStats(props.values, props.items));
const specialized = RED_SKILLS.filter((s) => s.specializationKind);
const rows = computed(() =>
  RED_SKILLS.flatMap((skill) => {
    const owned = (props.values.skills || []).filter(
      (s) => s.key === skill.key,
    );
    return (owned.length ? owned : [{ uid: skill.key, rank: 0 }]).map(
      (entry) => ({
        ...skill,
        ...entry,
        savedUid: owned.length ? entry.uid : null,
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
    .filter((g) => g.rows.length),
);
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
function addSpecial() {
  const name = specialName.value.trim();
  if (
    !name ||
    (props.values.skills || []).some(
      (s) =>
        s.key === specialSkill.value &&
        s.specialization?.toLowerCase() === name.toLowerCase(),
    )
  )
    return;
  emit("patch", {
    skills: [
      ...(props.values.skills || []),
      {
        uid: crypto.randomUUID(),
        key: specialSkill.value,
        rank: 0,
        specialization: name,
      },
    ],
  });
  specialName.value = "";
}
</script>
