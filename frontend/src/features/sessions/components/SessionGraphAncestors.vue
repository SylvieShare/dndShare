<template>
  <div ref="element" class="session-graph-ancestors" @scroll="$emit('scroll', $event.target.scrollLeft)">
    <div class="session-graph-ancestor session-graph-ancestor--chapter" title="Действия с главой"
      :role="isDm ? 'button' : undefined" :tabindex="isDm ? 0 : -1"
      :aria-label="chapter ? `Действия с главой ${chapter.number}` : 'Действия с главой'"
      @click.stop="$emit('chapter-menu',$event)" @dblclick.stop="$emit('chapter-back')"
      @keydown.enter.stop.prevent="$emit('chapter-menu',$event)" @keydown.space.stop.prevent="$emit('chapter-menu',$event)">
      <ChapterGraphNode v-if="chapter" embedded :show-link-port="false" :chapter="chapter" :current="chapter.id === currentChapterId" spotlight />
    </div>
    <div v-if="level === 'blocks' && scene" class="session-graph-ancestor session-graph-ancestor--scene" title="Действия со сценарием"
      :role="isDm ? 'button' : undefined" :tabindex="isDm ? 0 : -1"
      @click.stop="$emit('scene-menu',$event)" @dblclick.stop="$emit('scene-back')"
      @keydown.enter.stop.prevent="$emit('scene-menu',$event)" @keydown.space.stop.prevent="$emit('scene-menu',$event)">
      <SceneGraphNode :scene="scene" spotlight />
    </div>
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue'
import ChapterGraphNode from './ChapterGraphNode.vue'
import SceneGraphNode from './SceneGraphNode.vue'
defineProps({ chapter:Object, scene:Object, level:String, currentChapterId:[String,Number], isDm:Boolean })
const emit = defineEmits(['scroll','chapter-menu','chapter-back','scene-menu','scene-back'])
const element = ref(null)
onMounted(() => emit('scroll', element.value?.scrollLeft || 0))
</script>
<style scoped>
/* Follow the sidebar's live width; a second left transition would trail behind it. */
.session-graph-ancestors {position:absolute;z-index:20;top:calc(var(--chapter-chrome-height,64px) + 14px);left:var(--chapter-safe-left,0px);right:var(--chapter-safe-right,0px);display:flex;gap:16px;overflow-x:auto;scrollbar-width:none;overscroll-behavior-x:contain;touch-action:pan-x}
.session-graph-ancestors::-webkit-scrollbar {display:none}
.session-graph-ancestor {position:relative;flex:0 0 236px;z-index:20;width:236px;height:156px;cursor:zoom-out}
.session-graph-ancestor:focus-visible {outline:2px solid var(--accent);outline-offset:-2px;border-radius:13px}
</style>
