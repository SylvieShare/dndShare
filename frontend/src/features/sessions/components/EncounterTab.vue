<template>
  <div
    ref="encounterRoot"
    class="enc-wrap"
    :class="{
      'enc-wrap--workspace': workspace,
      'enc-wrap--columns': hasColumns,
      'enc-wrap--compact-roster': compactRoster,
    }"
  >


    <div class="enc-content"><div class="enc-combat-primary">
      <!-- ── Combat ── -->
      <Transition name="enc-combat-scene">
        <div class="enc-combat-scene">
          <div class="enc-block enc-block--combat">
            <h2 class="enc-section-title"><span class="enc-section-dot" />БОЕВАЯ СЦЕНА</h2>
            <div class="enc-section">
              <div
                v-if="combatItems.length === 0"
                class="enc-empty"
                data-sortable-container="combat"
              >
                {{ enc.encounter.active
                  ? 'На боевой сцене пока нет участников'
                  : 'Выберите игроков и существ, затем начните бой' }}
              </div>
              <div
                v-else
                class="enc-rows"
                data-sortable-container="combat"
              >
                <EncounterRow
                  v-for="(c, idx) in combatItems"
                  :key="c.uid"
                  :combatant="c"
                  section="combat"
                  :idx="idx"
                  :divided="idx > 0"
                  :order="idx + 1"
                  :is-current="enc.encounter.active && c.uid === currentTurnUid"
                  @view-participant="$emit('view-participant', $event)"
                />
              </div>
            </div>
          </div>
        </div>
      </Transition>

    </div>

    </div>
    <aside class="enc-secondary" aria-label="Управление боем">
      <EncounterControls :session-uuid="sessionUuid" :encounter="enc" :selection="sceneSelection" :is-dm="isDm" :scene="scene" :show-shortcut-hints="showShortcutHints"
                         @toggle-combat="toggleCombat" @import-combat-block="$emit('import-combat-block',$event)" />
    </aside>

  </div>
</template>

<script setup>
import { computed, provide, reactive, ref } from 'vue'
import { useRosterSelection } from '../composables/useRosterSelection'
import EncounterControls from './EncounterControls.vue'
import EncounterRow from '@/features/sessions/components/EncounterRow'
import { useEncounterWorkspaceLayout } from '@/features/sessions/composables/useEncounterWorkspaceLayout'

const props = defineProps({
  sessionUuid: { type: String, required: true },
  isDm: { type: Boolean, default: false },
  workspace: { type: Boolean, default: false },
  encounter: { type: Object, required: true },
  scene: { type: Object, default: null },
  showShortcutHints: { type: Boolean, default: false },
})
defineEmits(['view-participant', 'import-combat-block'])

const enc = props.encounter
const encounterRoot = ref(null)
const { hasColumns, compactRoster } = useEncounterWorkspaceLayout(encounterRoot)

const toggleCombat = enc.toggleCombat

provide('encounter', enc)

const combatItems = computed(() => enc.sortable.displayItems('combat'))
const sceneSelection=reactive(useRosterSelection(enc,()=>enc.encounter.combatants))

const currentTurnUid = computed(() => enc.currentTurnUid)

defineExpose({ toggleCombat })
</script>

<style scoped src="./styles/EncounterTab.css"></style>
