<template>
  <div ref="viewport" class="session-roster-list" :data-scrollable="scrollable || undefined" :style="{'--roster-scrollbar-width':`${scrollbarWidth}px`}"><slot /></div>
</template>
<script setup>
import { onBeforeUnmount, onMounted, onUpdated, ref } from 'vue'
const viewport=ref(null),scrollable=ref(false),scrollbarWidth=ref(0),observed=new Set()
let observer,frame=0,disposed=false
function measure(){
  frame=0
  const node=viewport.value
  if(disposed||!node?.clientHeight)return
  scrollable.value=node.scrollHeight>node.clientHeight+1
  scrollbarWidth.value=scrollable.value?Math.max(0,node.offsetWidth-node.clientWidth):0
}
function schedule(){if(!disposed&&!frame)frame=requestAnimationFrame(measure)}
function track(){
  if(!observer||!viewport.value)return
  const nodes=new Set([viewport.value,...viewport.value.children])
  for(const node of observed)if(!nodes.has(node)){observer.unobserve(node);observed.delete(node)}
  for(const node of nodes)if(!observed.has(node)){observer.observe(node);observed.add(node)}
  schedule()
}
onMounted(()=>{observer=new ResizeObserver(schedule);track()})
onUpdated(track)
onBeforeUnmount(()=>{disposed=true;observer?.disconnect();observed.clear();cancelAnimationFrame(frame)})
</script>
<style scoped>
.session-roster-list {display:flex;flex:1;flex-direction:column;gap:0;min-width:0;min-height:0;overflow:auto;overscroll-behavior:contain;box-sizing:border-box;scrollbar-gutter:auto;padding-inline-end:max(0px,calc(var(--spacing-medium) - var(--roster-scrollbar-width,0px)));padding-bottom:var(--spacing-large)}
.session-roster-list > :deep(*) {flex-shrink:0}
</style>
