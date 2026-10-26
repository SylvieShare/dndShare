<template>
  <button type="button" class="hb-collection-button" :style="type.color ? { '--card-color': type.color } : {}" @click="emit('select')">
    <BaseTile class="hb-collection-card" :color="type.color || 'var(--accent-soft)'" interactive>
      <div class="hb-card-top">
        <span v-if="parentName" class="hb-card-parent">Раздел «{{ parentName }}»</span>
        <span v-else-if="childNames" class="hb-card-parent">Основной каталог</span>
        <span class="hb-card-name">{{ type.name }}</span>
        <p v-if="type.description" class="hb-card-desc">{{ type.description }}</p>
        <p v-if="childNames" class="hb-card-children">Подразделы: {{ childNames }}</p>
      </div>
      <div class="hb-card-bottom">
        <span class="hb-card-count">
          <strong class="hb-card-count-num">{{ type.countItems }}</strong>
          <span class="hb-card-count-label"> записей</span>
        </span>
      </div>
      <img v-if="type.iconImageUrl" class="hb-card-icon" :src="type.iconImageUrl" alt="" aria-hidden="true" />
    </BaseTile>
  </button>
</template>

<script setup>
import { BaseTile } from '@sylvieshare/share-ui'
defineProps({ type: { type: Object, required: true }, parentName: { type: String, default: '' }, childNames: { type: String, default: '' } })
const emit = defineEmits(['select'])
</script>

<style scoped>
.hb-collection-button {
  --r-lg: var(--radius-tile);
  display: flex;
  padding: 0;
  border: 0;
  border-radius: var(--radius-tile);
  background: transparent;
  color: var(--text-1);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}
.hb-collection-card {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--collection-padding);
  min-height: var(--collection-min-height);
  overflow: hidden;
}

.hb-collection-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 72% 35%,
    color-mix(in srgb, var(--card-color, var(--accent-soft)) 12%, transparent) 0%,
    transparent 65%
  );
  pointer-events: none;
}

/* Card top: name + description */
.hb-card-top {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-compact);
  position: relative;
  z-index: 1;
  padding-right: var(--collection-art-inset);
}

.hb-card-name {
  font-family: var(--type-collection-title-family);
  font-size: var(--type-collection-title-size);
  font-weight: var(--type-collection-title-weight);
  line-height: var(--type-collection-title-line-height);
  letter-spacing: var(--type-collection-title-tracking);
}
.hb-card-parent {
  color: var(--card-color, var(--accent-soft));
  text-transform: uppercase;
  font-family: var(--type-collection-relation-family);
  font-size: var(--type-collection-relation-size);
  font-weight: var(--type-collection-relation-weight);
  line-height: var(--type-collection-relation-line-height);
  letter-spacing: var(--type-collection-relation-tracking);
}

.hb-card-desc {
  color: var(--text-muted);
  margin: 0;
  font-family: var(--type-collection-description-family);
  font-size: var(--type-collection-description-size);
  font-weight: var(--type-collection-description-weight);
  line-height: var(--type-collection-description-line-height);
  letter-spacing: var(--type-collection-description-tracking);
}
.hb-card-children {
  margin: 0;
  color: var(--text-2);
  font-family: var(--type-collection-children-family);
  font-size: var(--type-collection-children-size);
  font-weight: var(--type-collection-children-weight);
  line-height: var(--type-collection-children-line-height);
  letter-spacing: var(--type-collection-children-tracking);
}

/* Card bottom: count */
.hb-card-bottom {
  position: relative;
  z-index: 1;
  margin-top: auto;
  padding-top: var(--spacing-medium);
  padding-right: var(--collection-art-inset);
}

.hb-card-count {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  color: var(--card-color, var(--accent-soft));
}

.hb-card-count-num {
  color: var(--card-color, var(--accent-soft));
  font-variant-numeric: tabular-nums;
  font-family: var(--type-collection-count-family);
  font-size: var(--type-collection-count-size);
  font-weight: var(--type-collection-count-weight);
  line-height: var(--type-collection-count-line-height);
  letter-spacing: var(--type-collection-count-tracking);
}

.hb-card-count-label {
  font-size: var(--type-collection-description-size);
  line-height: var(--type-collection-description-line-height);
  color: var(--text-muted);
}

.hb-card-icon {
  position: absolute;
  right: var(--collection-padding);
  top: 50%;
  transform: translateY(-50%);
  width: var(--collection-emblem);
  height: var(--collection-emblem);
  object-fit: contain;
  opacity: 0.78;
  filter: drop-shadow(0 10px 18px color-mix(in srgb, var(--card-color, var(--accent-soft)) 22%, transparent));
  pointer-events: none;
}
</style>
