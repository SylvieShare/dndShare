<template>
  <aside class="workspace-tools-rail"><slot /></aside>
</template>
<style scoped>
.workspace-tools-rail {
  position: absolute;
  z-index: 16;
  top: 14px;
  right: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 66px;
  max-height: calc(100% - 28px);
  overflow-y: auto;
  scrollbar-width: thin;
}
</style>
