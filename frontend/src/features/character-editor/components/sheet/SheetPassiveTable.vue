<template>
  <table class="sheet-passive-table" aria-label="Пассивные показатели">
    <caption>Пассивные показатели</caption>
    <tbody>
      <tr><th scope="row"><Eye :size="16" aria-hidden="true" />Внимательность</th><td>{{ perception }}</td></tr>
      <tr><th scope="row"><Search :size="16" aria-hidden="true" />Расследование</th><td>{{ investigation }}</td></tr>
    </tbody>
  </table>
</template>
<script setup>
import { Eye, Search } from '@lucide/vue'
defineProps({ perception: Number, investigation: Number })
</script>
<style scoped>
.sheet-passive-table {border-collapse:separate;border-spacing:0;table-layout:fixed;width:calc(100% - 2 * var(--spacing-xs));margin:var(--spacing-xs);border-radius:var(--radius-input);overflow:hidden;background:var(--bg);font-size:var(--type-context-size);line-height:var(--type-context-line-height);color:var(--text-2)}
caption {padding:var(--spacing-xs) var(--spacing-small);text-align:left;color:var(--text-muted)}
th,td {padding:var(--spacing-small);border:0}
th {display:flex;align-items:center;gap:var(--spacing-small);font-weight:500;text-align:left}
th svg {flex:none;color:var(--text-muted)}
td {width:40px;text-align:right;font-variant-numeric:tabular-nums;font-size:var(--type-group-size);font-weight:700;color:var(--text-1)}
</style>
