<template>
  <BaseTile class="stub-tile" :color="accent" strip>
    <div class="stub-tile-title">{{ title }}</div>
    <div class="stub-tile-body">
      <img
        v-if="iconSrc"
        class="stub-tile-ic"
        :src="iconSrc"
        :style="iconStyle"
        alt=""
        aria-hidden="true"
      />
      <div class="stub-tile-sub">скоро</div>
    </div>
  </BaseTile>
</template>

<script setup>
import { computed } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import { svgColorFilter } from '@/shared/lib/svgColorFilter'

const props = defineProps(['block'])

const title = computed(() => props.block?.content?.title || props.block?.title || '')
const accent = computed(() => props.block?.content?.accent || 'var(--text-muted)')
const iconSrc = computed(() => props.block?.content?.svg || null)
const iconStyle = computed(() => ({ filter: svgColorFilter(accent.value) }))
</script>

<style scoped>
.stub-tile {
  width: 100%;
  min-height: 80px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 4px;
  padding: 10px 12px;
  user-select: none;
}

.stub-tile-body {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stub-tile-ic {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  opacity: 0.85;
}

.stub-tile-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stub-tile-sub {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}
</style>
