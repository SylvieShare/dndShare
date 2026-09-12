<template>
  <AppModalFrame title="Повышение уровня" :subtitle="`${total} → ${newTotal}`" :width="960" :dismissible="!saving" @close="emit('close')">

    <LoadingState v-if="loading" class="lu-muted" label="Загрузка справочника…" compact />

    <!-- ── Шаг 1: за кого повышаемся ── -->
    <template v-else-if="step === 'pick'">
      <div class="lu-sub">За какой класс берём уровень?</div>
      <div class="lu-opts">
        <button v-for="(e, i) in entries" :key="e.id" class="lu-opt" :disabled="e.level >= 20" @click="chooseClass(i)">
          <span class="lu-opt-mono">{{ monogram(e.name) }}</span>
          <span class="lu-opt-body">
            <span class="lu-opt-name">{{ e.name }}<span v-if="e.subclass" class="lu-opt-sub"> · {{ e.subclass.name }}</span></span>
            <span class="lu-opt-lvl">{{ e.level }} <span class="lu-arrow">→</span> {{ e.level + 1 }} уровень</span>
          </span>
        </button>

        <button class="lu-opt lu-opt-ghost" @click="step = 'newclass'">
          <span class="lu-opt-mono lu-opt-plus">+</span>
          <span class="lu-opt-body">
            <span class="lu-opt-name">Взять новый класс</span>
            <span class="lu-opt-lvl">мультикласс — 1 уровень нового класса</span>
          </span>
        </button>

        <button class="lu-opt lu-opt-plain" @click="choosePlain">
          <span class="lu-opt-mono lu-opt-plus">↑</span>
          <span class="lu-opt-body">
            <span class="lu-opt-name">Просто повысить уровень</span>
            <span class="lu-opt-lvl">без классовых умений — только уровень листа</span>
          </span>
        </button>
      </div>
    </template>

    <!-- ── Шаг 1б: выбор нового класса ── -->
    <template v-else-if="step === 'newclass'">
      <div class="lu-sub">
        <button class="lu-back" @click="step = 'pick'">←</button>
        Новый класс
      </div>
      <div class="lu-opts lu-opts-grid">
        <button
          v-for="c in newClassOptions"
          :key="c.id"
          class="lu-opt"
          @click="chooseNew(c)"
        >
          <span class="lu-opt-mono">{{ monogram(c.name) }}</span>
          <span class="lu-opt-body">
            <span class="lu-opt-name">{{ c.name }}</span>
            <span class="lu-opt-lvl" :class="{ 'lu-warn': !prereq(c).ok }">
              {{ prereq(c).ok ? 'требования выполнены' : 'нужно: ' + prereqLabel(c) }}
            </span>
          </span>
        </button>
      </div>
    </template>

    <!-- ── Шаг 2: что получаешь ── -->
    <template v-else-if="step === 'preview'">
      <div class="lu-sub">
        <button class="lu-back" @click="backToPick">←</button>
        <template v-if="isPlain">Уровень {{ newTotal }}</template>
        <template v-else>{{ classItem?.name }} · {{ isNew ? 'уровень 1' : `${targetEntry.level} → ${targetEntry.level + 1} уровень` }}</template>
      </div>

      <div v-if="isNew && !newPrereq.ok" class="lu-note lu-note-warn">
        Требование мультикласса не выполнено: {{ prereqLabel(classItem) }}. Взять класс всё равно можно — реши с мастером.
      </div>
      <div v-if="isMulticlass && (missingNewProfs || newProfChoice)" class="lu-note">
        <template v-if="missingNewProfs"><b>Будут добавлены владения:</b> {{ missingNewProfs }}.</template>
        <template v-if="newProfChoice"> <b>Нужно выбрать вручную:</b> {{ newProfChoice }}.</template>
      </div>

      <div class="lu-workspace" :class="{ 'lu-workspace-plain': isPlain }">
      <aside v-if="!isPlain" class="lu-sidebar">
        <LevelUpHitPoints :hp="hp" :sides="hitDieFace" :die-label="hitDieLabel" :current-max="hpMaximum(values.hp)" />
        <BaseTile class="lu-summary">
          <h3>С этим уровнем</h3>
          <div class="lu-summary-line"><span>Уровень персонажа</span><b>{{ newTotal }}</b></div>
          <div v-if="hitDieLabel" class="lu-summary-line"><span>Кости хитов</span><b>+1 {{ hitDieLabel }}</b></div>
          <div v-if="profChanges" class="lu-summary-line"><span>Бонус мастерства</span><b>+{{ profAfter }}</b></div>
          <ClassLevelGains v-if="slotChanges.length" :level="newClassLevel" :slot-changes="slotChanges" show-single-count />
        </BaseTile>
      </aside>
      <div class="lu-main">
      <!-- субкласс -->
      <div v-if="needSubclass" class="lu-sec">
        <div class="lu-sec-title">Выбери архетип <span class="lu-req" :class="{ done: !!subclassPick }">{{ subclassPick ? '✓' : 'обязательно' }}</span></div>
        <div class="lu-opts lu-opts-grid">
          <button
            v-for="s in subclassOptions"
            :key="s.id"
            class="lu-opt lu-opt-slim"
            :class="{ on: subclassPick?.id === s.id }"
            @click="subclassPick = s"
          >
            <span class="lu-opt-name">{{ s.name }}</span>
          </button>
        </div>
      </div>

      <!-- фичи нового уровня -->
      <div v-if="!isPlain" class="lu-sec">
        <div class="lu-sec-title">Новые умения</div>
        <p v-if="!features.length" class="lu-muted">На этом уровне класс не даёт новых умений{{ needSubclass && !subclassPick ? ' (выбери архетип — возможно, добавятся)' : '' }}.</p>
        <div v-for="f in features" :key="f.id" class="lu-feature">
          <LevelUpItemRow :item="f" :type-id="4" @details="viewFeature = f.id" />
          <template v-for="choice in featChoices(f)" :key="choice.key">
            <div class="lu-feat-choice-title">
              {{ choice.text || 'Сделай выбор' }}
              <span class="lu-req" :class="{ done: choiceCompleteFor(f, choice) }">{{ choiceSel(f, choice).length }} / {{ choiceCount(f, choice) }}</span>
            </div>
            <div v-if="choice.source === 'item'" class="lu-chips">
              <button
                v-for="itemId in choiceSel(f, choice)"
                :key="itemId"
                class="lu-chip on"
                @click="toggleFeatureChoice(f, choice, itemId)"
              >{{ featureChoiceItemNames[itemId] || `#${itemId}` }} <Trash2 :size="14" aria-hidden="true" /></button>
              <button
                v-if="choiceSel(f, choice).length < choiceCount(f, choice)"
                class="lu-roll"
                @click="featureItemChoice = { feature: f, choice }"
              >Выбрать из справочника…</button>
            </div>
            <div v-else class="lu-chips">
              <button
                v-for="opt in choiceOptions(f, choice)"
                :key="opt.value"
                class="lu-chip"
                :class="{ on: choiceSel(f, choice).some((v) => String(v) === String(opt.value)), off: choiceLocked(f, choice, opt) }"
                :title="opt.desc || ''"
                @click="toggleFeatureChoice(f, choice, opt.value)"
              >{{ opt.label }}</button>
            </div>
          </template>
        </div>
      </div>

      <AbilitySelectionPanel v-for="parent in abilitySelections.parents.value" :key="`${classItem?.id}:${newClassLevel}:${parent.id}:${abilitySelections.revision.value}`"
        class="lu-sec" :parent="parent" :values="abilitySelections.context.value" :original-values="values || {}"
        :items="abilitySelections.catalogue.value" :replacements="abilitySelections.replacements(parent)"
        @change="abilitySelections.change" />

      <!-- даруемые заклинания (домен/клятва/круг) -->
      <div v-if="grantedSpellList.length" class="lu-sec">
        <div class="lu-sec-title">Заклинания архетипа</div>
        <p class="lu-muted">Всегда подготовлены и не учитываются в числе подготовленных.</p>
        <div class="lu-item-list">
          <LevelUpItemRow v-for="sp in grantedSpellList" :key="sp.id" :item="sp" :type-id="5" @details="viewSpell = sp.id" />
        </div>
      </div>

      <div v-if="levelUpSpellContext" class="lu-sec">
        <div class="lu-sec-title">Заклинания класса</div>
        <LevelUpSpellSelection
          :key="`${levelUpSpellContext.tab.key}:${newClassLevel}`"
          :context="levelUpSpellContext"
          :existing-spells="levelUpSpellContext.tab.spells"
          @change="classSpellSelection = $event"
        />
      </div>

      <!-- ASI -->
      <div v-if="asiNow" class="lu-sec">
        <div class="lu-sec-title">
          Повышение характеристик
          <span class="lu-req" :class="{ done: asiComplete || asiSkipped }">{{ asiComplete || asiSkipped ? '✓' : 'сделай выбор' }}</span>
        </div>
        <template v-if="!asiSkipped">
          <MultiToggle :options="asiModes" :model-value="asiMode" @update:model-value="setAsiMode" />
          <div v-if="asiMode !== 'feat'" class="lu-chips">
            <button
              v-for="s in STATS"
              :key="s"
              class="lu-chip"
              :class="{ on: asiStats.includes(s), off: asiChipLocked(s) }"
              @click="toggleAsiStat(s)"
            >
              {{ STAT_SHORT[s] }} {{ statScore(s) }}<template v-if="asiStats.includes(s)"> → {{ statScore(s) + asiDelta }}</template>
            </button>
          </div>
          <template v-else>
            <button v-if="!featPick" class="lu-roll" @click="featPickerOpen = true">Выбрать черту…</button>
            <LevelUpItemRow v-else :item="featPick" :type-id="7" @details="featPickerOpen = true">
              <ActionButton variant="quiet" @click="featPickerOpen = true">Сменить</ActionButton>
            </LevelUpItemRow>
          </template>
        </template>
        <button class="lu-skip" @click="asiSkipped = !asiSkipped">{{ asiSkipped ? 'Вернуться к выбору' : 'Пропустить — решу позже' }}</button>
      </div>

      <p v-if="isPlain" class="lu-muted">Уровень персонажа станет {{ newTotal }}. Классовые возможности можно настроить в листе.</p>
      </div>
      </div>

    </template>

    <ItemViewModal v-if="viewSpell != null" :item-type-id="5" :item-id="viewSpell" @close="viewSpell = null" />
    <ItemViewModal
      v-if="viewFeature != null"
      :item-type-id="4"
      :item-id="viewFeature"
      @close="viewFeature = null"
    />

    <ItemPickerModal
      v-if="featPickerOpen"
      :item-type-ids="[7]"
      title="Выбор черты"
      search-placeholder="Поиск черты…"
      :item-eligibility="featEligibility"
      @pick="onFeatPick"
      @close="featPickerOpen = false"
    />

    <ItemPickerModal
      v-if="featureItemChoice"
      :item-type-ids="[Number(featureItemChoice.choice.from_item_type_id)]"
      :exclude-items="choiceSel(featureItemChoice.feature, featureItemChoice.choice)"
      title="Выбор для способности"
      search-placeholder="Поиск в справочнике…"
      :item-eligibility="featureChoiceItemEligibility"
      :fixed-filters="featureChoiceItemFilters"
      @pick="onFeatureChoiceItemPick"
      @close="featureItemChoice = null"
    />

    <FeatChoiceModal
      v-if="featConfigItem"
      :item="featConfigItem"
      :initial-choices="featConfigItem.selectedChoices || {}"
      :excluded-choices="featExcludedChoices"
      @confirm="onFeatChoicesConfirm"
      @close="featConfigItem = null"
    />
    <template v-if="step === 'preview'" #footer>
      <div class="lu-actions">
        <p v-if="saveError" class="lu-warn" role="alert">{{ saveError }}</p>
        <p v-else-if="!canAccept && !saving" class="lu-muted">Завершите обязательные выборы, чтобы продолжить.</p>
        <ActionButton variant="secondary" :disabled="saving" @click="emit('close')">Отмена</ActionButton>
        <ActionButton :disabled="!canAccept" :loading="saving" @click="accept">Повысить до {{ newTotal }} уровня</ActionButton>
      </div>
    </template>
  </AppModalFrame>
</template>

<script setup>
import AbilitySelectionPanel from '@/features/character-editor/components/AbilitySelectionPanel.vue'
import { ref } from 'vue'
import { ActionButton, AppModalFrame, BaseTile, LoadingState, MultiToggle } from '@sylvieshare/share-ui'
import { Trash2 } from '@lucide/vue'
import FeatChoiceModal from '@/features/character-editor/components/FeatChoiceModal.vue'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import ClassLevelGains from '@/features/items/detail-components/ClassLevelGains.vue'
import LevelUpItemRow from './LevelUpItemRow.vue'
import LevelUpHitPoints from './LevelUpHitPoints.vue'
import LevelUpSpellSelection from './LevelUpSpellSelection.vue'
import { hpMaximum } from '../lib/hp'
import { monogram } from './levelUpPresentation'
import { useDndLevelUp } from './useDndLevelUp'

const props = defineProps({ values: { type: Object, required: true } })
const emit = defineEmits(['close', 'apply'])
const viewSpell = ref(null)
const {
  loading, saving, saveError, step, entries, total, newTotal,
  chooseClass, chooseNew, choosePlain, backToPick, newClassOptions, prereq, prereqLabel,
  isPlain, isNew, classItem, targetEntry, newClassLevel, newPrereq, isMulticlass,
  missingNewProfs, newProfChoice, needSubclass, subclassOptions, subclassPick, features, featChoices,
  choiceCompleteFor, choiceSel, choiceCount, featureChoiceItemNames, toggleFeatureChoice, featureItemChoice, choiceOptions,
  choiceLocked, grantedSpellList, levelUpSpellContext, classSpellSelection, hp, hitDieLabel, hitDieFace,
  asiNow, asiComplete, asiSkipped, asiModes, asiMode, setAsiMode, STATS,
  STAT_SHORT, asiStats, asiChipLocked, toggleAsiStat, statScore, asiDelta, featPick,
  featPickerOpen, profChanges, profAfter, slotChanges, viewFeature, featEligibility, onFeatPick,
  featureChoiceItemEligibility, featureChoiceItemFilters, onFeatureChoiceItemPick, featConfigItem, featExcludedChoices, onFeatChoicesConfirm, canAccept,
  accept, abilitySelections,
} = useDndLevelUp(props, emit)
</script>

<style scoped src="./styles/DndLevelUpModal.css"></style>
