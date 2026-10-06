<template>
  <section class="map-tile-reference" aria-label="Справочник тайлов">
    <div class="map-reference-catalogue">
      <MapTilePalette
        :editor="editor"
        @collection="reference.changeCollection"
        compact
        grouped
        mode="inspect"
        :selected-id="reference.base?.id"
        @model="reference.choose"
      />
    </div>
    <form
      v-if="reference.draft"
      class="map-reference-form"
      @submit.prevent="reference.save"
      @keydown.ctrl.s.prevent.stop="reference.save"
      @keydown.meta.s.prevent.stop="reference.save"
    >
      <h2>{{ reference.base.sourceCode }} · {{ reference.base.name }}</h2>
      <DetailSection
        label="Исходные данные тайла"
        collapsible
        :default-open="false"
        class="map-reference-identity"
      >
        <dl>
          <dt>Коллекция</dt>
          <dd>
            {{ reference.base.collectionName }} ·
            {{ reference.base.collection }}
          </dd>
          <dt>Исходный код</dt>
          <dd>{{ reference.base.sourceCode }}</dd>
          <dt>Исходное имя</dt>
          <dd>{{ reference.base.sourceName }}</dd>
          <dt>Версия</dt>
          <dd>{{ reference.base.version }}</dd>
          <dt>UUID</dt>
          <dd>{{ reference.base.id }}</dd>
        </dl>
      </DetailSection>
      <p class="map-hint">
        Параметры применяются к новым размещениям. Уже собранные карты сохраняют
        прежние версии тайлов. Правка разметки не меняет саму 3D-модель.
      </p>
      <fieldset :disabled="reference.saving">
        <MapModelFields :model="reference.draft" />
        <div class="map-model-workbench">
          <div class="map-model-visual">
            <MapModelPreview
              :model="reference.draft"
              :source="selected"
              :active-field="activeField"
              :selected-slot="selectedSlot"
              :selected-point="selectedPoint"
              :disabled="reference.saving"
              @active="activeField = $event"
              @slot="selectedSlot = $event"
              @point="selectedPoint = $event"
            />
            <MapModelGeometryFields
              :model="reference.draft"
              @active="activeField = $event"
            />
            <p class="map-hint">
              Монтажная часть — ниже плоскости 0. Высоты поверхности и модели
              измеряются от нижней точки модели.
            </p>
          </div>
          <div class="map-model-dimensions">
            <MapModelSize
              :model="reference.draft"
              :disabled="reference.saving"
            />
            <MapModelSlots
              :model="reference.draft"
              :selected-slot="selectedSlot"
              @select="selectedSlot = $event"
            />
            <MapModelPlacementPoints
              :model="reference.draft"
              :selected-point="selectedPoint"
              @select="selectedPoint = $event"
            />
          </div>
        </div>
        <DetailSection
          :label="`Контуры препятствий (${reference.draft.blockers.length})`"
          collapsible
          :default-open="false"
        >
          <p class="map-hint">
            Полигоны в координатах тайла: [[[x, y], [x, y], [x, y]]]. Их точки
            должны находиться в занимаемых клетках.
          </p>
          <FormTextarea
            v-model:value="reference.blockers"
            aria-label="Контуры препятствий"
            :rows="8"
          />
        </DetailSection>
      </fieldset>
      <p v-if="reference.error" class="map-error" role="alert">
        {{ reference.error
        }}<ActionButton type="button" variant="quiet" @click="reference.reload"
          >Обновить справочник</ActionButton
        >
      </p>
      <p v-if="reference.status" role="status">{{ reference.status }}</p>
      <div class="map-reference-actions">
        <ActionButton
          type="submit"
          :loading="reference.saving"
          :disabled="!reference.dirty"
          ><Save :size="16" />Сохранить параметры</ActionButton
        ><ActionButton
          type="button"
          variant="secondary"
          :disabled="reference.saving || !reference.dirty"
          @click="reference.reset"
          >Отменить изменения</ActionButton
        >
      </div>
    </form>
    <ConfirmDialog
      v-if="reference.confirmDiscard"
      title="Отменить изменения параметров?"
      message="У текущего тайла есть несохранённые параметры."
      confirm-label="Отменить изменения"
      cancel-label="Продолжить редактирование"
      @confirm="reference.discard"
      @cancel="reference.confirmDiscard = false"
    />
  </section>
</template>
<script setup>
import { computed, reactive, ref, watch } from "vue";
import {
  ActionButton,
  ConfirmDialog,
  DetailSection,
  FormTextarea,
} from "@sylvieshare/share-ui";
import { Save } from "@lucide/vue";
import MapTilePalette from "./MapTilePalette.vue";
import MapModelFields from "./MapModelFields.vue";
import MapModelPreview from "./MapModelPreview.vue";
import MapModelPlacementPoints from "./MapModelPlacementPoints.vue";
import MapModelSize from "./MapModelSize.vue";
import MapModelGeometryFields from "./MapModelGeometryFields.vue";
import MapModelSlots from "./MapModelSlots.vue";
import { useModelReference } from "../composables/useModelReference";
const props = defineProps({ editor: Object });
const reference = reactive(useModelReference(props.editor));
const selectedPoint = ref(-1);
const activeField = ref(""),
  selectedSlot = ref(-1);
watch(
  () => reference.base?.id,
  () => {
    activeField.value = "";
    selectedSlot.value = -1;
  },
);
const selected = computed(() =>
  props.editor.catalogue.find((m) => m.id === reference.base?.id),
);
defineExpose({
  prepareLeave: reference.prepareLeave,
  changeCollection: reference.changeCollection,
});
</script>
<style scoped>
.map-tile-reference {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  min-height: 0;
  flex: 1;
  overflow: hidden;
}
.map-reference-catalogue {
  padding: 18px;
  border-right: 1px solid var(--border-strong);
  overflow: auto;
}
.map-reference-form {
  padding: 24px;
  overflow: auto;
  min-width: 0;
}
.map-reference-form h2 {
  margin: 0 0 18px;
  font-size: 20px;
}
.map-reference-form fieldset {
  margin: 20px 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.map-reference-identity {
  margin-bottom: 12px;
}
.map-reference-identity dl {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 4px 12px;
  margin: 0;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.map-reference-identity dt {
  color: var(--text-muted);
  margin-top: 6px;
}
.map-reference-identity dd {
  margin: 0;
}
.map-reference-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}
.map-model-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 20px;
  align-items: start;
}
.map-model-visual {
  position: sticky;
  top: 0;
  min-width: 0;
}
.map-model-dimensions {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
@media (max-width: 1150px) {
  .map-model-workbench {
    grid-template-columns: minmax(0, 1fr);
  }
  .map-model-visual {
    position: static;
  }
}
@media (max-width: 760px) {
  .map-tile-reference {
    grid-template-columns: minmax(0, 1fr);
  }
  .map-reference-catalogue {
    max-height: 250px;
    border-right: 0;
    border-bottom: 1px solid var(--border-strong);
  }
  .map-reference-form {
    padding: 16px;
  }
}
</style>
