<template>
  <article class="red-print">
    <header>
      <h1>{{ values.identity.handle }}</h1>
      <p>
        Cyberpunk RED ·
        {{
          values.roles.map((r) => `${roleName(r.key)} ${r.rank}`).join(" / ")
        }}
      </p>
    </header>
    <div class="rp-metrics">
      <span>HP {{ values.health.current }} / {{ hpMaximum }}</span
      ><span>Humanity {{ values.humanity.current }}</span
      ><span>LUCK {{ values.luck.current }} / {{ values.stats.LUCK }}</span
      ><span>Деньги {{ values.economy.cashEb }} eb</span
      ><span>IP {{ values.progression.ipAvailable }}</span
      ><span>Репутация {{ values.progression.reputation }}</span>
    </div>
    <h2>Характеристики</h2>
    <div class="rp-metrics">
      <span v-for="s in RED_STATS" :key="s.key"
        >{{ s.key }}: {{ values.stats[s.key] }}</span
      >
    </div>
    <h2>Навыки</h2>
    <div class="rp-skills">
      <div v-for="s in allSkills" :key="s.uid">
        {{ RED_SKILLS_BY_KEY[s.key]?.name || s.key }} {{ s.specialization }}:
        {{ s.rank }}
        <small
          >({{
            (stats[RED_SKILLS_BY_KEY[s.key]?.statKey] || 0) + s.rank
          }})</small
        >
      </div>
    </div>
    <h2>Снаряжение</h2>
    <table>
      <thead>
        <tr>
          <th>Предмет</th>
          <th>Кол.</th>
          <th>Параметры</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="e in values.inventory.entries" :key="e.uid">
          <td>
            {{ byKey[e.key]?.name || e.key
            }}{{ e.equipped ? " · экипировано" : "" }}
          </td>
          <td>{{ e.count }}</td>
          <td>
            {{
              redBaseWeaponDamage(
                byKey[e.key]?.facts,
                stats.BODY,
                values.cyberware.installations.some(
                  (i) => i.key === "cyberware-cyberarm" && !i.disabled,
                ),
              )
            }}<span v-if="byKey[e.key]?.facts.magazine">
              · {{ e.loaded || 0 }} /
              {{ byKey[e.key].facts.magazine }} патронов</span
            ><span v-if="byKey[e.key]?.facts.bodySP">
              · SP тела
              {{
                Math.max(0, byKey[e.key].facts.bodySP - (e.ablation?.body || 0))
              }}</span
            ><span v-if="byKey[e.key]?.facts.headSP">
              · SP головы
              {{
                Math.max(0, byKey[e.key].facts.headSP - (e.ablation?.head || 0))
              }}</span
            >
          </td>
        </tr>
      </tbody>
    </table>
    <h2>Киберимпланты</h2>
    <p v-for="e in values.cyberware.installations" :key="e.uid">
      {{ byKey[e.key]?.name || e.key }} · {{ e.location || "тело"
      }}<span v-if="e.parentUid">
        · основание
        {{
          byKey[
            values.cyberware.installations.find((p) => p.uid === e.parentUid)
              ?.key
          ]?.name
        }}</span
      >
    </p>
    <h2>Сеть и программы</h2>
    <p v-for="p in values.netrunning.loadedPrograms" :key="p.uid">
      {{ byKey[p.key]?.name || p.key }} · REZ {{ p.rez }} ·
      {{ p.active ? "активна" : "выключена" }}
    </p>
    <p class="rp-text">{{ values.netrunning.discovered }}</p>
    <h2>Травмы и состояния</h2>
    <p>Штраф проверки смерти: {{ values.health.deathSavePenalty }}</p>
    <p v-for="i in values.health.injuries" :key="i.uid">
      {{ byKey[i.key]?.name || i.key }}
    </p>
    <p v-for="s in values.health.conditions" :key="s.uid">
      {{ s.name || s.key }} {{ s.notes }}
    </p>
    <h2>Способности ролей</h2>
    <section v-for="r in values.roles" :key="r.uid">
      <h3>{{ roleName(r.key) }} · {{ r.rank }}</h3>
      <p>
        {{
          Object.entries(r.choices || {})
            .map(
              ([k, v]) =>
                `${choiceLabels[k] || k}: ${Array.isArray(v) ? v.map((key) => byKey[key]?.name || key).join(", ") : v}`,
            )
            .join(" · ")
        }}
      </p>
      <p class="rp-text">{{ r.notes }}</p>
    </section>
    <h2>Жизненный путь</h2>
    <img
      v-if="values.identity.avatar?.url"
      class="rp-portrait"
      :src="values.identity.avatar.url"
      alt="Портрет"
    />
    <p v-for="[key, label] in RED_LIFEPATH_FIELDS" :key="key">
      <strong>{{ label }}:</strong> {{ values.lifepath.general[key] || "—" }}
    </p>
    <h3>Путь роли</h3>
    <p v-for="[key, label] in roleFields" :key="key">
      <strong>{{ label }}:</strong>
      {{ values.lifepath.roleSpecific[key] || "—" }}
    </p>
    <p>
      Жильё:
      {{
        byKey["housing-" + values.economy.housingKey]?.name ||
        values.economy.housingKey
      }}
      · Образ жизни:
      {{
        byKey["lifestyle-" + values.economy.lifestyleKey]?.name ||
        values.economy.lifestyleKey
      }}
    </p>
  </article>
</template>
<script setup>
import { redBaseWeaponDamage } from "../../../settings/cyberpunk-red/cyberWeapons";
import { computed } from "vue";
import {
  RED_STATS,
  RED_SKILLS,
  RED_SKILLS_BY_KEY,
  RED_ROLES,
} from "../../../settings/cyberpunk-red/catalogue";
import {
  redEffectiveStats,
  redMaximumHealth,
} from "../../../settings/cyberpunk-red/equipment";
import {
  RED_LIFEPATH_FIELDS,
  RED_ROLE_LIFEPATH,
} from "../../../settings/cyberpunk-red/lifepath";
const props = defineProps({ values: Object, items: Array });
const byKey = computed(() =>
  Object.fromEntries(props.items.map((i) => [i.key, i])),
);
const allSkills = computed(() =>
  RED_SKILLS.flatMap((s) => {
    const owned = props.values.skills.filter((v) => v.key === s.key);
    return owned.length ? owned : [{ key: s.key, uid: s.key, rank: 0 }];
  }),
);
const choiceLabels = {
  damageDeflection: "Отражение урона",
  fumbleRecovery: "Восстановление промаха",
  initiative: "Инициатива",
  precisionAttack: "Точная атака",
  spotWeakness: "Слабое место",
  threatDetection: "Обнаружение угроз",
  field: "Полевая экспертиза",
  upgrade: "Модернизация",
  fabrication: "Изготовление",
  invention: "Изобретение",
  surgery: "Хирургия",
  pharmaceuticals: "Фармацевтика",
  cryosystem: "Криосистемы",
  knownRecipes: "Рецепты",
};
const stats = computed(() => redEffectiveStats(props.values, props.items));
const hpMaximum = computed(() => redMaximumHealth(props.values, props.items));
const roleName = (key) => RED_ROLES.find((r) => r.key === key)?.name || key;
const roleFields = computed(
  () => RED_ROLE_LIFEPATH[props.values.roles[0]?.key] || [],
);
</script>
<style scoped>
.red-print {
  color-scheme: light;
  background: Canvas;
  color: CanvasText;
  width: min(100%, 210mm);
  margin: auto;
  padding: 14mm;
  font:
    11pt/1.45 Arial,
    sans-serif;
  box-sizing: border-box;
}
.red-print h1 {
  font-size: 24pt;
}
.red-print h2 {
  font-size: 16pt;
  margin-top: 8mm;
}
.red-print h3 {
  font-size: 12pt;
}
.rp-metrics {
  display: flex;
  gap: 4mm;
  flex-wrap: wrap;
}
.rp-skills {
  columns: 2;
  column-gap: 10mm;
}
.rp-skills > div {
  break-inside: avoid;
}
.red-print table {
  width: 100%;
  border-collapse: collapse;
}
.red-print td,
.red-print th {
  padding: 2mm;
  text-align: left;
  border-bottom: 1px solid GrayText;
}
.red-print tr {
  break-inside: avoid;
}
.rp-text {
  white-space: pre-wrap;
}
.rp-portrait {
  float: right;
  width: 45mm;
  max-height: 60mm;
  object-fit: cover;
  margin: 3mm;
}
@media print {
  .red-print {
    padding: 8mm;
    width: 100%;
  }
  .red-print h2,
  .red-print h3 {
    break-after: avoid;
  }
}
</style>
