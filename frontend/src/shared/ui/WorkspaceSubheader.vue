<template>
  <div class="workspace-subheader" :class="{ 'workspace-subheader--inline': inline }">
    <div class="workspace-subheader-inner" :class="{ 'workspace-subheader-inner--fit': fit }" :style="{ '--workspace-subheader-max-width':contentWidth || '100%' }"><slot /></div>
  </div>
</template>
<script setup>
defineProps({ contentWidth: String, fit: { type: Boolean, default: true }, inline:Boolean })
</script>
<style scoped>
.workspace-subheader { position:relative;z-index:1;flex:none;min-width:0;padding:0 var(--workspace-subheader-inset,var(--spacing-page));background:var(--subheader); }
.workspace-subheader-inner { display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;max-width:var(--workspace-subheader-max-width);min-width:0;margin-inline:auto;padding:var(--workspace-subheader-padding,0);overflow-x:auto; }
.workspace-subheader-inner--fit { width:max-content;max-width:min(100%,var(--workspace-subheader-max-width)); }
.workspace-subheader--inline { flex:1;padding:0;width:100%; }
@media (--ui-phone) { .workspace-subheader:not(.workspace-subheader--inline) {padding-inline:var(--workspace-subheader-inset,var(--spacing-small));} }
</style>
