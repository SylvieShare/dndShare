<template>
  <div class="weapon-card-layout" :class="{ 'weapon-card-layout--illustrated': !!$slots.icon }">
    <div v-if="$slots.icon" class="weapon-card-layout__icon"><slot name="icon" /></div>
    <div class="weapon-card-layout__heading"><slot name="heading" /></div>
    <div v-if="$slots.controls" class="weapon-card-layout__controls"><slot name="controls" /></div>
  </div>
</template>
<style scoped>
.weapon-card-layout {display:grid;grid-template-columns:minmax(0,1fr);gap:var(--spacing-label) var(--spacing-medium);padding:var(--layout-weapon-card-padding) var(--spacing-large);min-width:0}
.weapon-card-layout--illustrated {grid-template-columns:var(--layout-weapon-card-icon) minmax(0,1fr)}
.weapon-card-layout__icon {display:grid;place-items:center;align-self:center;width:var(--layout-weapon-card-icon);height:var(--layout-weapon-card-icon);min-width:0}
.weapon-card-layout__heading {min-width:0;align-self:center}
.weapon-card-layout__controls {grid-column:1/-1;min-width:0}
</style>
