<template>
  <div class="dict-view">
    <template v-if="item">
      <div
        class="view-head"
        :style="item.color ? { '--item-color': item.color } : {}"
      >
        <div class="view-head-bg" aria-hidden="true"></div>

        <div
          class="view-icon"
          :style="item.color ? { background: item.color + '22', borderColor: item.color + '55', color: item.color } : {}"
        >
          <SvgIcon v-if="item.svg" class="view-icon-svg" :svg="item.svg" />
          <span v-else class="view-icon-placeholder">{{ (item.value || '?')[0]?.toUpperCase() }}</span>
        </div>

        <div class="view-title-block">
          <div class="view-name">{{ item.value }}</div>
          <div class="view-meta">
            <span v-if="item.code" class="view-meta-code">{{ item.code }}</span>
            <span
              v-if="item.color"
              class="view-meta-color"
              :style="{ background: item.color + '22', color: item.color, borderColor: item.color + '55' }"
            >
              <span class="view-color-dot" :style="{ background: item.color }"></span>
              {{ item.color }}
            </span>
          </div>
        </div>

        <div class="view-head-right">
          <div class="view-menu-wrap">
            <button v-if="canEdit" class="view-menu-btn" @click="menuOpen = !menuOpen">···</button>
            <div v-if="menuOpen" class="view-menu">
              <button class="view-menu-item" @click="$emit('edit'); menuOpen = false">Редактировать</button>
              <button
                v-if="isAdmin && item.userId != null"
                class="view-menu-item"
                @click="makeBase(); menuOpen = false"
              >Сохранить общим</button>
              <button class="view-menu-item view-menu-item-danger" @click="deleteItem(); menuOpen = false">Удалить</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="item.desc" class="view-content">
        <RichContent class="view-desc-text" :html="item.desc" />
      </div>
    </template>
    <div v-else class="empty-hint">Выберите значение</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { fetchPost } from '@/shared/api/http'
import RichContent from '@/shared/ui/RichContent'
import SvgIcon from '@/shared/ui/SvgIcon'

const props = defineProps({
  item: { type: Object, default: null },
  typeId: { type: Number, default: null },
  canEdit: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
})

const emit = defineEmits(['edit', 'saved', 'deleted'])

const menuOpen = ref(false)

async function makeBase() {
  if (!props.item || !props.isAdmin) return
  try {
    const updated = await fetchPost('/suggest/' + props.typeId + '/' + props.item.id + '/make-base', null)
    emit('saved', updated)
  } catch { /* ignore */ }
}

async function deleteItem() {
  if (!props.item) return
  try {
    const { fetchDelete } = await import('@/shared/api/http')
    await fetchDelete('/suggest/' + props.typeId + '/' + props.item.id)
    emit('deleted', props.item)
  } catch { /* ignore */ }
}
</script>

<style scoped>
.dict-view {
  width: 360px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border);
  overflow-y: auto;
  background: var(--bg);
}

.empty-hint {
  color: var(--text-2);
  font-size: 14px;
  padding: 60px 0;
  text-align: center;
  margin: auto 0;
}

/* ── Head ── */
.view-head {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 16px;
  flex-shrink: 0;
  background: var(--bg-header);
}

.view-head-bg {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at 80% 20%,
    color-mix(in srgb, var(--item-color, transparent) 18%, transparent) 0%,
    transparent 70%
  );
  pointer-events: none;
}

.view-icon {
  flex-shrink: 0;
  position: relative;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.09);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.view-icon-svg {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: currentColor;
}
.view-icon-placeholder {
  font-size: 17px;
  font-weight: 700;
  color: currentColor;
}

.view-title-block {
  flex: 1;
  min-width: 0;
  position: relative;
}
.view-name {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.view-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 3px;
}

.view-meta-code {
  font-size: 11px;
  color: var(--text-muted);
  font-family: monospace;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px;
  padding: 1px 6px;
}

.view-meta-color {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-family: monospace;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 1px 6px;
}

.view-color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.view-head-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  position: relative;
}

.view-menu-wrap { position: relative; }
.view-menu-btn {
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 5px;
  font-family: inherit;
}
.view-menu-btn:hover { color: var(--text-1); background: rgba(255,255,255,0.06); }

.view-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 90;
  min-width: 180px;
  background: #1e1e22;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 9px;
  box-shadow: 0 10px 28px rgba(0,0,0,0.45);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.view-menu-item {
  border: none;
  background: none;
  font: inherit;
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
  padding: 8px 10px;
  border-radius: 6px;
  text-align: left;
}
.view-menu-item:hover { background: rgba(255,255,255,0.06); color: var(--text-1); }
.view-menu-item-danger { color: var(--danger); }
.view-menu-item-danger:hover { color: var(--danger); background: rgba(224,85,85,0.08); }

/* ── Content ── */
.view-content {
  padding: 4px 16px 16px;
}

.view-desc-text {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
}

@media (max-width: 1200px) {
  .dict-view { width: 300px; }
}
</style>
