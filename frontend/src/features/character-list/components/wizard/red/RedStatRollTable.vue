<template>
  <details v-if="rows.length" class="stat-roll-table">
    <summary>Таблица характеристик · {{ roleName }}</summary>
    <p v-if="rolls.length" class="table-note">
      {{ wholeRow ? 'Выделена выпавшая строка.' : 'В каждом столбце выделено выпавшее значение.' }}
    </p>
    <p class="table-scroll-note">На узком экране таблицу можно прокрутить вбок.</p>
    <div class="table-scroll" tabindex="0" role="region" :aria-label="`Таблица характеристик роли «${roleName}»`">
      <table :aria-label="`Характеристики роли «${roleName}» по броскам d10`">
        <thead>
          <tr><th scope="col">d10</th><th v-for="stat in RED_STATS" :key="stat.key" scope="col"><abbr :title="stat.name">{{ stat.key }}</abbr></th></tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="index">
            <th scope="row" :class="{ picked: wholeRow && rolls[0] === index + 1 }">{{ index + 1 }}</th>
            <td
              v-for="(value, column) in row"
              :key="RED_STATS[column].key"
              :class="{ picked: rolls[wholeRow ? 0 : column] === index + 1 }"
            >{{ value }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </details>
</template>

<script setup>
import { RED_STATS } from '@/features/character-editor/settings/cyberpunk-red/catalogue'

defineProps({
  rows: { type: Array, required: true },
  rolls: { type: Array, required: true },
  roleName: { type: String, required: true },
  wholeRow: Boolean,
})
</script>

<style scoped>
.stat-roll-table { min-width: 0; }
.stat-roll-table summary { cursor: pointer; padding-block: var(--spacing-small); }
.stat-roll-table summary:focus-visible, .table-scroll:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.table-note, .table-scroll-note { margin: 0 0 var(--spacing-small); color: var(--text-muted); font-size: var(--type-group-size); }
.table-scroll-note { display: none; }
.table-scroll { overflow-x: auto; border-radius: var(--radius-large); }
table {
  width: 100%;
  min-width: 550px;
  table-layout: fixed;
  border-spacing: 0;
  background: var(--surface);
  font-variant-numeric: tabular-nums;
  font-size: var(--type-row-size);
}
th, td { padding: var(--spacing-small); text-align: center; }
thead th { background: var(--surface-raised); color: var(--text-2); }
tbody tr:nth-child(even) { background: var(--bg); }
th:first-child {
  position: sticky;
  inset-inline-start: 0;
  z-index: 1;
  background: var(--surface-raised);
}
th.picked, td.picked { background: color-mix(in srgb, var(--accent) 40%, var(--surface)); color: var(--text-1); font-weight: 700; }
@media (max-width: 599px) {
  .table-scroll-note { display: block; }
}
</style>
