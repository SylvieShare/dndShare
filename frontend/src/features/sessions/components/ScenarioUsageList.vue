<template>
  <div v-if="resolved.length" class="scenario-usage-list">
    <button v-for="entry in resolved" :key="entry.scene.id" type="button" @click="$emit('open', entry.scene.id)">
      <img :src="entry.scene.imageUrl" alt="" />
      <span>
        <strong>{{ entry.scene.name }}</strong>
        <small>{{ contextLabel(entry.scene) }}</small>
      </span>
      <em>{{ blockLabel(entry.usage.blockCount) }}</em>
    </button>
  </div>
  <p v-else class="session-world-muted">Объект ещё не добавлен на холст сценария.</p>
</template>

<script setup>
import { computed } from 'vue'
import { ruPlural } from '@/features/sessions/lib/sessionWorld'

const props = defineProps({
  usages: { type: Array, default: () => [] },
  scenes: { type: Array, default: () => [] },
})
defineEmits(['open'])

const resolved = computed(() => {
  const scenesById = new Map(props.scenes.map(scene => [Number(scene.id), scene]))
  return props.usages
    .map(usage => ({ usage, scene: scenesById.get(Number(usage.sceneId)) }))
    .filter(entry => entry.scene)
    .sort((a, b) => (a.scene.arcOrder - b.scene.arcOrder)
      || a.scene.chapterNumber.localeCompare(b.scene.chapterNumber, 'ru', { numeric: true })
      || a.scene.name.localeCompare(b.scene.name, 'ru'))
})

function contextLabel(scene) {
  const chapter = [scene.chapterNumber, scene.chapterName].filter(Boolean).join(' · ')
  return [scene.arcName, chapter].filter(Boolean).join(' · ')
}

function blockLabel(count) {
  return `${count} ${ruPlural(count, 'блок', 'блока', 'блоков')}`
}
</script>

<style scoped>
.scenario-usage-list { width: 100%; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 520px)); justify-content: start; gap: 5px 10px; }
.scenario-usage-list button { width: 100%; max-width: 520px; display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 7px; border: 1px solid var(--border); border-radius: 10px; background: color-mix(in srgb, var(--surface-raised) 78%, transparent); color: var(--text-2); cursor: pointer; text-align: left; }
.scenario-usage-list button:hover { border-color: var(--accent); }
.scenario-usage-list img { width: 56px; height: 42px; border-radius: 8px; object-fit: cover; }
.scenario-usage-list button > span { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.scenario-usage-list strong, .scenario-usage-list small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scenario-usage-list strong { color: var(--text-1); font-size: 12px; }
.scenario-usage-list small { color: var(--text-muted); font-size: 9px; }
.scenario-usage-list em { padding: 4px 6px; border-radius: 6px; background: color-mix(in srgb, var(--accent) 9%, transparent); color: var(--accent-soft); font-size: 9px; font-style: normal; font-weight: 700; white-space: nowrap; }
</style>
