<template>
  <div class="weapon-card-layout" :class="{ 'weapon-card-layout--collapsed': collapsed }">
    <div class="weapon-card-layout__header" :class="{ 'weapon-card-layout__header--illustrated': !!$slots.icon, 'weapon-card-layout__header--actions': !!$slots.actions }">
      <div v-if="$slots.icon" class="weapon-card-layout__icon"><slot name="icon" /></div>
      <div class="weapon-card-layout__heading"><slot name="heading" /></div>
      <div v-if="$slots.actions" class="weapon-card-layout__actions"><slot name="actions" /></div>
    </div>
    <div v-if="$slots.controls" class="weapon-card-layout__body" :inert="collapsed" :aria-hidden="collapsed">
      <div class="weapon-card-layout__clip"><div class="weapon-card-layout__controls"><slot name="controls" /></div></div>
    </div>
  </div>
</template>
<script setup>
defineProps({ collapsed: Boolean })
</script>
<style scoped>
.weapon-card-layout {padding:var(--layout-weapon-card-padding) var(--spacing-large);min-width:0}
.weapon-card-layout__header {display:grid;grid-template-columns:minmax(0,1fr);gap:var(--spacing-medium);align-items:center;min-width:0}
.weapon-card-layout__header--illustrated {grid-template-columns:var(--layout-weapon-card-icon) minmax(0,1fr)}
.weapon-card-layout__header--actions {grid-template-columns:minmax(0,1fr) auto}
.weapon-card-layout__header--illustrated.weapon-card-layout__header--actions {grid-template-columns:var(--layout-weapon-card-icon) minmax(0,1fr) auto}
.weapon-card-layout__icon {display:grid;place-items:center;align-self:center;width:var(--layout-weapon-card-icon);height:var(--layout-weapon-card-icon);min-width:0}
.weapon-card-layout__heading {min-width:0;align-self:center}
.weapon-card-layout__actions {display:flex;align-items:center}
.weapon-card-layout__body {display:grid;grid-template-rows:1fr;opacity:1;transition:grid-template-rows var(--motion-navigation),opacity var(--motion-feedback)}
.weapon-card-layout--collapsed .weapon-card-layout__body {grid-template-rows:0fr;opacity:0}
.weapon-card-layout__clip {min-height:0;overflow:hidden}
.weapon-card-layout__controls {padding-top:var(--spacing-label);min-width:0}
@media (prefers-reduced-motion:reduce) {.weapon-card-layout__body {transition:none}}
</style>
