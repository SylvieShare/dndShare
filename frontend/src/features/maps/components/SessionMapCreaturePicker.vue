<template>
  <span ref="anchor" class="map-creature-picker-trigger"><ActionButton icon-only variant="quiet" aria-label="На карту" title="На карту" :aria-expanded="open" aria-haspopup="dialog" @click="open=!open"><template #icon><MapPin :size="20" /></template></ActionButton></span>
  <BasePopover v-model:open="open" :anchor="anchor" :close-on-resize="false" :close-on-scroll="false" placement="bottom-end" :min-width="layoutTokens['map-sidebar']" role="dialog" aria-label="На карту">
    <div class="map-creature-picker-content"><p v-if="error" class="map-error" role="status">{{error}}</p><SessionMapCreatures related-menus :editor="editor" :candidates="candidates" :selected="selected" @focus="$emit('focus',$event)" @place="$emit('place',$event)" @drag="(item,event)=>$emit('drag',item,event)" /></div>
  </BasePopover>
</template>
<script setup>
import { ref } from 'vue'
import { ActionButton,BasePopover } from '@sylvieshare/share-ui'
import { MapPin } from '@lucide/vue'
import { layoutTokens } from '@/app/design-tokens'
import SessionMapCreatures from './SessionMapCreatures.vue'
defineProps({editor:Object,candidates:Array,selected:String,error:String})
defineEmits(['focus','place','drag'])
const anchor=ref(null),open=ref(false)
defineExpose({close:()=>{open.value=false}})
</script>
<style scoped>
.map-creature-picker-trigger {display:inline-flex;flex:none}
.map-creature-picker-content {box-sizing:border-box;min-width:0;max-height:65dvh;overflow:auto;overscroll-behavior:contain;padding:var(--spacing-medium)}
</style>
