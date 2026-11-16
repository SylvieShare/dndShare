<template>
  <svg v-if="rough" class="workspace-row-divider workspace-row-divider--rough" viewBox="0 -50 1000 100" preserveAspectRatio="none" aria-hidden="true"><path :d="path" vector-effect="non-scaling-stroke" /></svg>
  <span v-else class="workspace-row-divider" aria-hidden="true" />
</template>

<script setup>
import { computed } from 'vue'
import { roughRowSeamPath } from './roughRowSeam'
const props=defineProps({rough:Boolean,roughVariant:{type:Number,default:0}})
const path=computed(()=>roughRowSeamPath(props.roughVariant))
</script>

<style scoped>
.workspace-row-divider {
  position: absolute;
  inset-inline: 0;
  top: 0;
  height: var(--layout-workspace-row-divider-height);
  background: var(--border-strong);
  opacity: .55;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(to right, transparent, var(--text-1) 9%, var(--text-1) 91%, transparent);
  mask-image: linear-gradient(to right, transparent, var(--text-1) 9%, var(--text-1) 91%, transparent);
  clip-path: polygon(0 44%,3% 33%,7% 45%,11% 15%,15% 42%,20% 37%,25% 53%,29% 20%,33% 39%,38% 41%,43% 23%,48% 55%,52% 43%,58% 35%,63% 16%,68% 44%,73% 39%,78% 53%,82% 19%,87% 45%,92% 34%,97% 47%,100% 39%,100% 68%,97% 77%,92% 65%,87% 76%,82% 59%,78% 82%,73% 70%,68% 75%,63% 51%,58% 65%,52% 74%,48% 84%,43% 61%,38% 72%,33% 70%,29% 56%,25% 83%,20% 67%,15% 73%,11% 54%,7% 76%,3% 63%,0 75%);
}
.workspace-row-divider--rough {top:calc(var(--spacing-small) / -2);width:100%;height:var(--spacing-small);background:none;opacity:.8;mask:none;-webkit-mask:none;clip-path:none;overflow:visible;fill:none;stroke:var(--border-strong);stroke-width:var(--layout-border);stroke-linejoin:round;stroke-linecap:butt}
</style>
