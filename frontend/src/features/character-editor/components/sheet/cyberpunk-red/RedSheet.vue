<template>
  <div v-if="!ready" class="red-panel" role="alert">
    Данные листа RED неполны. Откройте сохранённого персонажа или завершите
    создание.
  </div>
  <div v-else ref="body" class="red-sheet" :class="[`red-sheet--${format}`, { 'red-sheet--focused-skills': section === 'skills' }]">
    <aside v-if="format === 'desktop'" v-show="section !== 'skills'" ref="statsColumn">
      <RedSkills
        :values="values"
        :items="catalogue.items.value"
        :editable="editable"
        compact
        @roll="roll = $event"
        @patch="patch"
      />
    </aside>
    <main class="red-stack">
      <p v-if="catalogue.error.value" role="alert">
        {{ catalogue.error.value }}
        <ActionButton @click="catalogue.load">Повторить</ActionButton>
      </p>
      <p v-if="error" role="alert" class="red-danger">{{ error }}</p>
      <div
        v-if="catalogue.loading.value"
        class="red-skeleton"
        aria-label="Загрузка справочника"
      />
      <template v-if="section === 'base'"
        ><RedResources
          v-if="format !== 'desktop'"
          :values="values"
          :items="catalogue.items.value"
          :editable="editable"
          @patch="patch"
          @roll="roll = $event"
          @action="newSession" /><BaseTile :outlined="false"
          ><div class="red-panel">
            <h2>Защита и здоровье</h2>
            <div class="red-two">
              <div>
                Тело <strong class="red-metric">SP {{ bodyArmor.sp }}</strong>
              </div>
              <div>
                Голова <strong class="red-metric">SP {{ headArmor.sp }}</strong>
              </div>
            </div>
            <div class="red-actions">
              <ActionButton v-if="editable" @click="damage = true"
                >Получить урон</ActionButton
              ><ActionButton v-if="editable" @click="stabilize"
                >Стабилизирован</ActionButton
              ><ActionButton v-if="editable" @click="heal"
                >День восстановления</ActionButton
              ><ActionButton @click="printSheet">Печать</ActionButton>
            </div>
            <small
              >Стабилизацию подтверждает ведущий после успешной проверки.</small
            >
          </div></BaseTile
        ><BaseTile :outlined="false"
          ><div class="red-panel">
            <div class="red-row">
              <h2>Травмы</h2>
              <ActionButton
                v-if="editable"
                @click="
                  roll = {
                    kind: 'injury',
                    location: 'body',
                    title: 'Травма тела',
                  }
                "
                >2d6 · тело</ActionButton
              ><ActionButton
                v-if="editable"
                @click="
                  roll = {
                    kind: 'injury',
                    location: 'head',
                    title: 'Травма головы',
                  }
                "
                >2d6 · голова</ActionButton
              >
              <ActionButton v-if="editable" @click="injuryPicker = true"
                >Добавить</ActionButton
              >
            </div>
            <div
              v-for="injury in values.health.injuries"
              :key="injury.uid"
              class="red-row"
            >
              <div>
                {{ catalogue.byKey.value[injury.key]?.name || injury.key
                }}<small
                  >Штраф смерти +{{
                    catalogue.byKey.value[injury.key]?.facts.deathPenalty || 0
                  }}</small
                >
              </div>
              <ActionButton
                v-if="editable"
                variant="quiet"
                @click="removeInjury(injury)"
                >Вылечена</ActionButton
              >
            </div>
            <p v-if="!values.health.injuries.length">Нет критических травм.</p>
          </div></BaseTile
        ><RedCombatActions
          :values="values"
          :maximum="redMaximumHealth(values, catalogue.items.value)"
          :editable="editable"
          @patch="patch"
          @roll="roll = $event" /><RedConditions
          :values="values"
          :items="catalogue.items.value"
          :editable="editable"
          @patch="patch"
          @roll="roll = $event" /><RedInventory
          combat
          :values="values"
          :items="catalogue.items.value"
          :editable="editable"
          @patch="patch"
          @roll="roll = $event"
          @damage="rollDamage"
      /></template>
      <RedSkills
        v-else-if="section === 'skills'"
        :values="values"
        :items="catalogue.items.value"
        :editable="editable"
        @patch="patch"
        @roll="roll = $event"
      />
      <RedInventory
        v-else-if="section === 'combat' || section === 'inventory'"
        :combat="section === 'combat'"
        :values="values"
        :items="catalogue.items.value"
        :editable="editable"
        @patch="patch"
        @roll="roll = $event"
        @damage="rollDamage"
      />
      <RedEconomy
        v-if="section === 'inventory'"
        :values="values"
        :items="catalogue.items.value"
        :editable="editable"
        @patch="patch"
      /><RedCyberware
        v-else-if="section === 'cyberware'"
        :values="values"
        :items="catalogue.items.value"
        :editable="editable"
        @patch="patch"
      />
      <RedNetrunning
        v-else-if="section === 'netrunning'"
        :values="values"
        :items="catalogue.items.value"
        :editable="editable"
        @patch="patch"
        @roll="roll = $event"
      />
      <RedRoles
        v-else-if="section === 'roles'"
        :items="catalogue.items.value"
        :values="values"
        :editable="editable"
        @patch="patch"
        @roll="roll = $event"
      />
      <RedPersonality
        v-else-if="section === 'personality'"
        :values="values"
        :editable="editable"
        @patch="patch"
      />
      <JournalWorkspace
        v-else-if="section === 'journal' && ctx.characterUuid"
        :character-uuid="ctx.characterUuid"
      />
      <p v-else-if="section === 'journal'">
        Дневник станет доступен после создания.
      </p>
    </main>
    <aside v-if="format === 'desktop'" ref="resourcesColumn">
      <RedResources
        :values="values"
        :items="catalogue.items.value"
        :editable="editable"
        @patch="patch"
        @roll="roll = $event"
        @action="newSession"
      />
    </aside>
    <RedRollDialog
      v-if="roll"
      :request="roll"
      :items="catalogue.items.value"
      @close="roll = null"
    />
    <RedDamageDialog
      v-if="damage"
      :values="values"
      :items="catalogue.items.value"
      @close="damage = false"
      @apply="patch"
    />
    <RedItemPicker
      v-if="injuryPicker"
      :items="catalogue.items.value"
      :kinds="['criticalInjury']"
      title="Критическая травма"
      @close="injuryPicker = false"
      @select="addInjury"
    />
  </div>
</template>
<script setup>
import { useBottomPinnedColumns } from "../../../composables/useBottomPinnedColumns";
import { computed, inject, ref } from "vue";
import { useRouter } from "vue-router";
import { BaseTile, ActionButton } from "@sylvieshare/share-ui";
import { characterSheetContext } from "../../../lib/sheetContext";
import { useRedCatalogue } from "../../../composables/useRedCatalogue";
import {
  redArmor,
  redNewSession,
  redHeal,
} from "../../../settings/cyberpunk-red/gameplay";
import RedCombatActions from "./RedCombatActions.vue";
import RedEconomy from "./RedEconomy.vue";
import { redMaximumHealth } from "../../../settings/cyberpunk-red/equipment";
import RedConditions from "./RedConditions.vue";
import JournalWorkspace from "@/features/journals/components/JournalWorkspace.vue";
import RedResources from "./RedResources.vue";
import RedSkills from "./RedSkills.vue";
import RedInventory from "./RedInventory.vue";
import RedCyberware from "./RedCyberware.vue";
import RedNetrunning from "./RedNetrunning.vue";
import RedPersonality from "./RedPersonality.vue";
import RedRoles from "./RedRoles.vue";
import RedRollDialog from "./RedRollDialog.vue";
import RedDamageDialog from "./RedDamageDialog.vue";
import RedItemPicker from "./RedItemPicker.vue";
defineProps({ section: String, format: String });
const ctx = inject("charCtx", {}),
  sheet = inject(characterSheetContext),
  catalogue = useRedCatalogue();
const body = ref(null),
  statsColumn = ref(null),
  resourcesColumn = ref(null);
useBottomPinnedColumns(body, [statsColumn, resourcesColumn]);
const router = useRouter();
const values = computed(() => sheet.values.value),
  editable = computed(() => !!ctx.ownerMode);
const ready = computed(
  () =>
    values.value.stats &&
    values.value.health &&
    values.value.inventory &&
    values.value.humanity &&
    values.value.luck,
);
const bodyArmor = computed(() =>
    redArmor(values.value, catalogue.items.value, "body"),
  ),
  headArmor = computed(() =>
    redArmor(values.value, catalogue.items.value, "head"),
  );
const roll = ref(null),
  damage = ref(false),
  error = ref(""),
  injuryPicker = ref(false);
function patch(value) {
  if (editable.value) ctx.updateValues?.(value);
}
function newSession() {
  patch({ luck: redNewSession(values.value).luck });
}
function stabilize() {
  if (values.value.health.dead) {
    error.value = "Погибшего персонажа нельзя стабилизировать";
    return;
  }
  patch({
    health: {
      ...values.value.health,
      current: Math.max(1, values.value.health.current),
      stabilized: true,
      deathSavePenalty: 0,
    },
  });
}
function heal() {
  try {
    patch({ health: redHeal(values.value, catalogue.items.value, 1).health });
    error.value = "";
  } catch (e) {
    error.value = e.message;
  }
}
function addInjury(item) {
  if (values.value.health.injuries.some((e) => e.key === item.key)) {
    error.value = "Эта травма уже есть — перебросьте результат";
    return;
  }
  patch({
    health: {
      ...values.value.health,
      injuries: [
        ...values.value.health.injuries,
        { uid: crypto.randomUUID(), key: item.key, itemId: item.id },
      ],
    },
  });
  injuryPicker.value = false;
}
function removeInjury(injury) {
  patch({
    health: {
      ...values.value.health,
      injuries: values.value.health.injuries.filter(
        (e) => e.uid !== injury.uid,
      ),
    },
  });
}
function rollDamage(entry) {
  const item = catalogue.byKey.value[entry.key];
  roll.value = {
    kind: "damage",
    entryUid: entry.uid,
    title: "Урон: " + (item?.name || entry.key),
  };
}
function printSheet() {
  if (ctx.characterUuid) router.push(`/char/${ctx.characterUuid}/print`);
  else error.value = "Печать доступна после сохранения персонажа";
}
</script>
<style src="./redSheet.css"></style>
