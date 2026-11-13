<template>
  <div class="workspace-subheader">
    <div class="workspace-subheader-inner" :class="{ 'workspace-subheader-inner--fit': fit }" :style="{ '--workspace-subheader-max-width':contentWidth || '100%' }"><slot /></div>
  </div>
</template>
<script setup>
defineProps({ contentWidth: String, fit: { type: Boolean, default: true } })
</script>
<style scoped>
.workspace-subheader { --workspace-subheader-default-background:color-mix(in srgb,var(--subheader) 25%,var(--bg));position:relative;z-index:1;flex:none;min-width:0;padding:var(--spacing-xs) var(--workspace-subheader-inset,var(--spacing-page));background:var(--workspace-subheader-background,var(--workspace-subheader-default-background)); }
.workspace-subheader-inner { --surface:var(--workspace-subheader-background,var(--workspace-subheader-default-background));display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;max-width:var(--workspace-subheader-max-width);min-width:0;margin-inline:auto;padding:var(--workspace-subheader-padding,0);overflow-x:auto; }
.workspace-subheader-inner--fit { width:max-content;max-width:min(100%,var(--workspace-subheader-max-width)); }
</style>
