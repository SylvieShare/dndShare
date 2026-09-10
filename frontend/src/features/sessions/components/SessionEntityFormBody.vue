<template>
  <div class="session-entity-form-body">
    <SessionMaterialPreview v-if="type === 'material' && !editing && entity && ['image', 'map', 'video'].includes(draft.kind)" :material="entity" />
    <div class="session-entity-form-fields">
      <template v-for="field in bodyFields" :key="field.key">
        <SessionEntityFormField :field="field" />
        <div v-if="field.key === 'description' && $slots['after-description']" class="session-entity-after-description"><slot name="after-description" /></div>
      </template>
    </div>
    <UniversalRelationList
      :relations="draft.relations"
      :items="relationItems"
      :source-type="type"
      :source-id="entity?.id"
      :editable="editable"
      :force-open="editing"
      :saving="saving || busy"
      :persist="changeRelations"
      @open="form.openEntity($event)"
    />
    <p v-if="error || racesError" class="session-entity-form-error" role="alert">{{ error || racesError }}</p>
    <FormActionButtons
      v-if="editing"
      :submit-text="entity ? 'Сохранить' : 'Создать'"
      :loading="saving || busy || uploading"
      :can-submit="entityDraftValid(type, draft)"
      @cancel="form.cancel"
      @submit="submit"
    />
  </div>
</template>
<script setup>
import { toRefs } from 'vue'
import { FormActionButtons } from '@sylvieshare/share-ui'
import UniversalRelationList from './UniversalRelationList.vue'
import SessionMaterialPreview from './SessionMaterialPreview.vue'
import SessionEntityFormField from './SessionEntityFormField.vue'
import { entityDraftValid } from '../lib/sessionEntityForm'
import { useSessionEntityForm } from '../lib/sessionEntityFormContext'
const form = useSessionEntityForm()
const { type, entity, editing, editable, saving, relationItems } = toRefs(form.props)
const { draft, busy, uploading, error, racesError, bodyFields, changeRelations, submit } = form
</script>
<style scoped>
.session-entity-form-body { display: flex; flex-direction: column; gap: 22px; min-width: 0; }
.session-entity-form-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.session-entity-after-description { grid-column: 1 / -1; }
.session-entity-form-error { color: var(--danger); }
@media (max-width: 720px) { .session-entity-form-fields { grid-template-columns: 1fr; } }
</style>
