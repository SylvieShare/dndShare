<template>
  <article class="spell-card" :class="`spell-card--span-${spell.span || 1}`">
    <header class="spell-head">
      <div class="spell-level"><span>{{ levelMark }}</span><small>{{ levelUnit }}</small></div>
      <div class="spell-title">
        <div class="spell-name-row">
          <h3>{{ spell.name }}</h3>
          <span v-if="spell.prepared" class="spell-prepared">подготовлено</span>
        </div>
        <div class="spell-tags">
          <span v-if="spell.school">{{ spell.school }}</span>
          <span v-if="spell.data.concentration">Концентрация</span>
          <span v-if="spell.data.ritual">Ритуал</span>
        </div>
      </div>
    </header>

    <dl class="spell-meta">
      <div><dt>Время</dt><dd>{{ spell.data.time || '—' }}</dd></div>
      <div><dt>Дистанция</dt><dd>{{ spell.data.range || '—' }}</dd></div>
      <div><dt>Длительность</dt><dd>{{ spell.data.duration || '—' }}</dd></div>
      <div><dt>Компоненты</dt><dd>{{ components }}</dd></div>
    </dl>

    <div v-if="spell.combatLine" class="spell-combat">{{ spell.combatLine }}</div>

    <RichContent v-if="spell.data.description" class="spell-description" :html="spell.data.description" />
    <p v-else class="spell-empty">Описание отсутствует.</p>

    <div v-if="spell.data.upper" class="spell-higher">
      <strong>На более высоких уровнях</strong>
      <RichContent :html="spell.data.upper" />
    </div>

    <footer v-if="spell.source" class="spell-source">{{ spell.source }}</footer>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import RichContent from '@/shared/ui/DndRichContent.vue'

const props = defineProps({ spell: { type: Object, required: true } })

const levelMark = computed(() => props.spell.level === 0 ? 'З' : props.spell.level > 0 ? props.spell.level : '—')
const levelUnit = computed(() => props.spell.level === 0 ? 'заговор' : props.spell.level > 0 ? 'круг' : 'уровень')
const components = computed(() => {
  const data = props.spell.data.components || {}
  const labels = [data.v ? 'В' : '', data.s ? 'С' : '', data.m ? 'М' : ''].filter(Boolean)
  const material = typeof data.m === 'string' ? ` (${data.m})` : ''
  return (labels.join(', ') || '—') + material
})
</script>

<style scoped>
.spell-card {
  position: relative;
  min-width: 0;
  align-self: start;
  padding: 3.5mm;
  border: 1px solid #695a44;
  background: rgba(255, 254, 250, .92);
  box-shadow: inset 0 0 0 .8mm #fffefa, inset 0 0 0 1mm #c8baa0;
  break-inside: avoid;
  overflow: hidden;
}
.spell-card::before { content: ''; position: absolute; top: 1.2mm; left: 1.2mm; width: 5mm; height: 5mm; border-top: .5px solid #8a7a61; border-left: .5px solid #8a7a61; }
.spell-card--span-1 { grid-column: span 1; }
.spell-card--span-2 { grid-column: span 2; }
.spell-card--span-3 { grid-column: 1 / -1; }
.spell-head { display: grid; grid-template-columns: 10mm minmax(0, 1fr); gap: 2.5mm; align-items: start; padding-bottom: 2.5mm; border-bottom: .5px solid #b9ab93; }
.spell-level { width: 9mm; height: 9mm; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #695a44; border-radius: 50%; }
.spell-level span { font: 700 12px/.8 Georgia, serif; }
.spell-level small { margin-top: .7mm; font: 700 4.5px/1 Arial, sans-serif; letter-spacing: .05em; text-transform: uppercase; color: #756751; }
.spell-title { min-width: 0; }
.spell-name-row { display: flex; align-items: baseline; flex-wrap: wrap; gap: 1.5mm; }
.spell-title h3 { min-width: 0; margin: 0; font: 700 13px/1.15 Georgia, serif; overflow-wrap: anywhere; }
.spell-prepared { font: 700 5px/1 Arial, sans-serif; letter-spacing: .07em; text-transform: uppercase; color: #6a593e; }
.spell-tags { display: flex; flex-wrap: wrap; gap: 1mm; margin-top: 1.3mm; }
.spell-tags span { padding: .7mm 1.4mm; border: .4px solid #baaa8d; font: 700 5px/1 Arial, sans-serif; letter-spacing: .04em; text-transform: uppercase; color: #6f604a; }
.spell-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5mm 2.5mm; margin: 2.5mm 0; }
.spell-meta div { min-width: 0; border-bottom: .35px solid #d1c7b5; padding-bottom: .8mm; }
.spell-meta dt { font: 700 5px/1 Arial, sans-serif; letter-spacing: .07em; text-transform: uppercase; color: #81725b; }
.spell-meta dd { margin: .7mm 0 0; font: 7px/1.25 Arial, sans-serif; overflow-wrap: anywhere; }
.spell-combat { margin: 2mm 0; padding: 1.5mm 2mm; border-left: 1.5px solid #695a44; background: #f1ede4; font: 700 7px/1.35 Arial, sans-serif; }
.spell-description { color: #332e27; font: 7.2px/1.42 Georgia, serif; text-align: left; }
.spell-description :deep(p) { margin-bottom: 1.5mm; }
.spell-description :deep(h1), .spell-description :deep(h2), .spell-description :deep(h3), .spell-description :deep(h4) { color: #332e27; font-size: 8px; margin: 2mm 0 1mm; }
.spell-description :deep(ul), .spell-description :deep(ol) { margin: 1.3mm 0 1.8mm 4mm; }
.spell-description :deep(table) { max-width: 100%; font-size: 6.4px; }
.spell-description :deep(td), .spell-description :deep(th) { border-color: #baaa8d; padding: .7mm 1mm; }
.spell-empty { margin: 2mm 0 0; color: #81725b; font: italic 7px Georgia, serif; }
.spell-higher { margin-top: 2.5mm; padding-top: 2mm; border-top: .5px solid #b9ab93; color: #332e27; font: 7px/1.42 Georgia, serif; }
.spell-higher > strong { display: block; margin-bottom: 1mm; font: 700 5.5px/1 Arial, sans-serif; letter-spacing: .07em; text-transform: uppercase; color: #6f604a; }
.spell-source { margin-top: 2.5mm; padding-top: 1.5mm; border-top: .35px solid #d1c7b5; font: 5.5px/1.2 Arial, sans-serif; color: #81725b; }
</style>
