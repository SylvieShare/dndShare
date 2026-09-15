<template>
  <button ref="trigger" type="button" class="session-treasure-trigger" :class="{ active: open }"
    title="Сокровища" aria-label="Сокровища" :aria-expanded="open" @click="open = !open">
    <Gem :size="24" /><span>Сокровища</span>
  </button>
  <BasePopover v-model:open="open" :anchor="trigger" min-width="min(320px, calc(100vw - 16px))" placement="right-start" transition-preset="action-menu">
    <div class="session-treasure-menu">
      <TreasureGenerator v-if="ready && isDnd" :controller="treasure" />
      <LoadingState v-else-if="!ready && !error" label="Открываем сокровища…" />
      <p v-else-if="error" role="alert">{{ error }}</p>
      <p v-else>Генератор сокровищ доступен для D&D 5e · 2014. Выберите эту редакцию в меню игровой системы.</p>
    </div>
  </BasePopover>
  <ItemViewModal v-if="treasure.selected" :item="treasure.selected" :item-id="treasure.selected.id"
    :item-type-id="treasure.selected.typeId" @close="treasure.selected = null" />
</template>
<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Gem } from '@lucide/vue'
import { BasePopover, LoadingState } from '@sylvieshare/share-ui'
import { useGameContextStore } from '@/stores/gameContext'
import { isDnd5e2014 } from '@/shared/lib/gameSystems'
import { useTreasureGenerator } from '@/features/master-tools/composables/useTreasureGenerator'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import TreasureGenerator from '@/features/master-tools/components/TreasureGenerator.vue'

const game = useGameContextStore()
const trigger = ref(null), open = ref(false), ready = ref(false), error = ref('')
const isDnd = computed(() => isDnd5e2014(game.context))
const treasure = reactive(useTreasureGenerator(computed(() => ready.value && isDnd.value ? game.sourceVersionId : null)))
watch(open, async value => {
  if (!value || ready.value) return
  error.value = ''
  try { await game.ensure(); ready.value = true }
  catch { error.value = 'Не удалось загрузить игровую систему. Закройте и откройте сокровища ещё раз.' }
})
</script>
<style scoped>
.session-treasure-trigger { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; min-height: 54px; padding: 5px 0; border: 0; background: transparent; color: var(--text-muted); cursor: pointer; }
.session-treasure-trigger span { font: 700 10px/1.2 var(--font-ui); }
.session-treasure-trigger:hover, .session-treasure-trigger.active { color: var(--text-1); }
.session-treasure-menu { width: min(780px, calc(100vw - 40px)); max-height: calc(100dvh - 80px); overflow-y: auto; padding: 12px; box-sizing: border-box; }
.session-treasure-menu > p { color: var(--text-muted); font-size: 13px; line-height: 1.6; padding: 12px; }
</style>
