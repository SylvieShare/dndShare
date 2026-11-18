<template>
  <section class="basic-actions" aria-label="Памятка по действиям">
    <header class="basic-actions-heading">
      <div><span class="basic-actions-eyebrow">Памятка игрока</span><h2>Твой ход</h2></div>
      <span class="basic-actions-edition">D&D {{ version }}</span>
    </header>
    <p class="basic-actions-intro">Двигайся, действуй и помогай группе. Нажми на карточку, чтобы узнать подробности.</p>
    <div class="basic-actions-budget" aria-label="Состав хода">
      <DndBasicActionCard v-for="entry in turnParts" :key="entry.id" :entry="entry" compact @open="selectedId = $event" />
    </div>
    <div class="basic-actions-section-heading"><h3>На что потратить действие</h3><span>Выбери один вариант</span></div>
    <div class="basic-actions-grid">
      <DndBasicActionCard v-for="entry in actions" :key="entry.id" :entry="entry" @open="selectedId = $event" />
    </div>
    <p class="basic-actions-note"><MessageCircle aria-hidden="true" />Короткая реплика и одно простое взаимодействие с предметом обычно не требуют отдельного действия.</p>
    <DndBasicActionCard :entry="improvisedAction" @open="selectedId = $event" />
    <p class="basic-actions-footnote">Общие варианты хода. Состояния и особенности персонажа могут менять доступные действия.</p>
    <AppModalFrame v-if="selected" :title="selected.title" width="560px" :z-index="3300" close-label="Закрыть" @close="selectedId = null">
      <div class="basic-action-detail">
        <span class="basic-actions-cost">{{ selected.cost }}</span>
        <p v-for="paragraph in selected.details" :key="paragraph">{{ paragraph }}</p>
        <BaseTile v-if="selected.example" :outlined="false" class="basic-actions-example"><strong>Например</strong><p>{{ selected.example }}</p></BaseTile>
        <a :href="basicActionSources[version]" target="_blank" rel="noopener noreferrer">Правила D&D {{ version }} <ExternalLink aria-hidden="true" /></a>
      </div>
    </AppModalFrame>
  </section>
</template>
<script setup>
import { computed, inject, ref } from 'vue'
import { AppModalFrame, BaseTile } from '@sylvieshare/share-ui'
import { ExternalLink, MessageCircle } from '@lucide/vue'
import { basicActions, basicActionSources, improvisedAction, turnParts } from '../../lib/basicActions'
import DndBasicActionCard from './DndBasicActionCard.vue'
const context = inject('charCtx', {})
const version = computed(() => context.rulesVersion || '2014')
const actions = computed(() => basicActions(version.value))
const selectedId = ref(null)
const selected = computed(() => [...turnParts, ...actions.value, improvisedAction].find(entry => entry.id === selectedId.value))
</script>
<style scoped>
.basic-actions { container: basic-actions / inline-size; display: grid; gap: var(--spacing-large); padding: var(--spacing-large) 0; }
.basic-actions-heading, .basic-actions-section-heading { display: flex; justify-content: space-between; align-items: center; gap: var(--spacing-medium); flex-wrap: wrap; }
.basic-actions-heading h2 { margin: var(--spacing-xs) 0 0; font-family: var(--font-display); font-size: var(--type-sheet-stat-size); line-height: 1.15; color: var(--text-1); }
.basic-actions-eyebrow { color: var(--accent-soft); font-size: var(--type-context-size); letter-spacing: .08em; text-transform: uppercase; }
.basic-actions-edition { padding: var(--spacing-small) var(--spacing-medium); border-radius: var(--radius-input); background: var(--surface); color: var(--text-muted); font-size: var(--type-context-size); }
.basic-actions-intro, .basic-actions-note, .basic-actions-footnote { margin: 0; color: var(--text-muted); font-size: var(--type-group-size); line-height: 1.6; }
.basic-actions-budget { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-small); }
.basic-actions-section-heading { margin-top: var(--spacing-large); align-items: baseline; }
.basic-actions-section-heading h3 { margin: 0; color: var(--text-1); font-size: var(--type-header-size); }
.basic-actions-section-heading > span, .basic-actions-footnote { color: var(--text-muted); font-size: var(--type-context-size); }
.basic-actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--layout-sheet-stat-min)), 1fr)); gap: var(--spacing-small); }
.basic-actions-note { display: flex; gap: var(--spacing-small); align-items: flex-start; padding: var(--spacing-small) 0; }
.basic-actions-note svg { flex: 0 0 var(--type-header-size); width: var(--type-header-size); margin-top: var(--spacing-xs); }
.basic-actions-cost { color: var(--accent-soft); font-size: var(--type-group-size); font-weight: 600; }
.basic-action-detail { color: var(--text-2); font-size: var(--type-body-size); line-height: var(--type-body-line-height); }
.basic-action-detail p { margin: var(--spacing-large) 0; }
.basic-actions-example { padding: var(--spacing-large); }
.basic-actions-example strong { color: var(--text-1); font-size: var(--type-group-size); }
.basic-actions-example p { margin-bottom: 0; }
.basic-action-detail a { display: inline-flex; align-items: center; gap: var(--spacing-small); margin-top: var(--spacing-large); color: var(--text-muted); font-size: var(--type-context-size); }
.basic-action-detail a svg { width: var(--type-context-size); height: var(--type-context-size); }
@container basic-actions (min-width: 680px) { .basic-actions-budget { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
</style>
