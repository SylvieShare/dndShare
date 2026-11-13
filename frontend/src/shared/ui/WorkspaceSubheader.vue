<template>
  <div class="workspace-subheader" :class="{ 'workspace-subheader--inline': inline, 'workspace-subheader--floating': floating }">
    <div class="workspace-subheader-inner" :class="{ 'workspace-subheader-inner--fit': fit }" :style="{ '--workspace-subheader-max-width':contentWidth || '100%' }"><slot /></div>
  </div>
</template>
<script setup>
defineProps({ contentWidth: String, fit: { type: Boolean, default: true }, inline:Boolean, floating:Boolean })
</script>
<style scoped>
.workspace-subheader { position:relative;z-index:1;flex:none;min-width:0;padding:var(--spacing-small) var(--workspace-subheader-inset,var(--spacing-page));background:var(--bg); }
.workspace-subheader-inner { display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;max-width:var(--workspace-subheader-max-width);min-width:0;margin-inline:auto;padding:var(--workspace-subheader-padding,0);overflow-x:auto;border-radius:var(--radius-large);background:var(--surface); }
.workspace-subheader-inner--fit { width:max-content;max-width:min(100%,var(--workspace-subheader-max-width)); }
.workspace-subheader--inline { flex:1;padding:0;background:transparent;width:100%; }
.workspace-subheader--floating { background:transparent;pointer-events:none; }
.workspace-subheader--floating .workspace-subheader-inner { pointer-events:auto;box-shadow:0 var(--spacing-xs) var(--spacing-large) color-mix(in srgb,var(--scrim) 32%,transparent); }
</style>
