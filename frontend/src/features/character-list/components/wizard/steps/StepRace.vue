<template>
  <div class="step">
    <div class="sheet-section-title">Раса</div>
    <p v-if="loading && !races.length" class="step-muted">Загрузка справочника…</p>
    <p v-else-if="!races.length" class="step-muted">В справочнике пока нет рас.</p>
    <div v-else class="grid">
      <SelectTile
        v-for="r in races"
        :key="r.id"
        :title="r.name"
        :subtitle="asiSummary(r)"
        :monogram="monogramOf(r.name)"
        :selected="state.race?.id === r.id"
        @select="state.race = r"
      />
    </div>

    <template v-if="subraces.length">
      <div class="sheet-section-title step-gap">Происхождение</div>
      <div class="grid">
        <SelectTile
          v-for="s in subraces"
          :key="s.id"
          :title="s.name"
          :subtitle="asiSummary(s)"
          :monogram="monogramOf(s.name)"
          :selected="state.subrace?.id === s.id"
          @select="state.subrace = s"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import SelectTile from '@/features/character-list/components/wizard/SelectTile.vue'
import { asiSummary, monogramOf } from '@/features/character-list/components/wizard/labels'

const { races, subraces, state, loading } = inject('createWizard')
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 12px; }
.step-gap { margin-top: 8px; }
.step-muted { font-size: 13px; color: var(--text-muted); margin: 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
</style>
