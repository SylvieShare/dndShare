<template>
  <details class="ability-advanced">
    <summary>Иконка и обложка</summary>
    <div class="item-media-editor">
      <FormField v-for="kind in ['icon', 'cover']" :key="kind" :label="kind === 'icon' ? 'Иконка' : 'Обложка'" :title="kind === 'icon' ? 'PNG или WebP до 5 МБ.' : 'PNG, WebP или JPEG до 5 МБ. Показывается в шапке карточки.'" vertical>
        <BaseTile class="item-media-preview" :class="`item-media-preview--${kind}`">
          <img v-if="url(kind)" :src="url(kind)" :alt="kind === 'icon' ? 'Иконка' : 'Обложка'" />
          <ItemIcon v-else-if="kind === 'icon' && !media.slots.icon.removed && item?.svg" :item="item" :fallback-to-type="false" :size="64" />
          <span v-else>{{ kind === 'icon' ? 'Иконка справочника' : 'Обложка справочника' }}</span>
        </BaseTile>
        <div class="ability-row-heading">
          <AddButton :label="url(kind) ? 'Заменить изображение' : 'Загрузить изображение'" @click="inputs[kind]?.click()" />
          <RemoveButton v-if="url(kind) || (kind === 'icon' && !media.slots.icon.removed && item?.svg)" icon="trash" :label="kind === 'icon' ? 'Удалить иконку' : 'Удалить обложку'" @click="pending = kind" />
        </div>
        <input :ref="el => inputs[kind] = el" type="file" :accept="kind === 'icon' ? 'image/png,image/webp' : 'image/png,image/webp,image/jpeg'" hidden @change="event => choose(kind, event)" />
      </FormField>
      <p v-if="error" role="alert">{{ error }}</p>
    </div>
  </details>
  <ConfirmDialog v-if="pending" title="Удалить изображение?" message="После сохранения будет использоваться оформление справочника." :z-index="zIndex + 300" @confirm="remove" @close="pending = ''" @cancel="pending = ''" />
</template>
<script setup>
import { ref } from 'vue'
import { AddButton, BaseTile, ConfirmDialog, FormField, RemoveButton } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
const props = defineProps({ item: Object, media: Object, zIndex: Number })
const inputs = {}, error = ref(''), pending = ref('')
function url(kind) { const slot = props.media.slots[kind]; return slot.preview || (slot.removed ? '' : props.item?.[`${kind}ImageUrl`]) }
function choose(kind, event) {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
  try { props.media.select(kind, file); error.value = '' } catch (e) { error.value = e.message }
}
function remove() { props.media.remove(pending.value); pending.value = '' }
</script>
<style scoped>
.item-media-editor { display: grid; grid-template-columns: minmax(100px, 1fr) minmax(0, 2fr); gap: 16px; }
.item-media-preview { display: grid; place-items: center; height: 110px; overflow: hidden; color: var(--text-muted); font-size: 11px; }
.item-media-preview img { width: 100%; height: 100%; object-fit: cover; }
.item-media-preview--icon img { object-fit: contain; }
@media (max-width: 420px) { .item-media-editor { grid-template-columns: 1fr; } }
</style>
