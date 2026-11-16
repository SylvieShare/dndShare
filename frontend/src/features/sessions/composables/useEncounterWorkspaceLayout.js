import { onBeforeUnmount, onMounted, ref } from 'vue'
import { spacingTokens } from '@/app/design-tokens'
import { encounterColumnsFit, encounterPrimaryWidth } from '../lib/encounterLayout'

export function useEncounterWorkspaceLayout(root) {
  const hasColumns=ref(false),compactRoster=ref(true)
  let observer
  function measure(){
    if(!root.value)return
    const available=root.value.clientWidth-2*spacingTokens.page
    hasColumns.value=encounterColumnsFit(available)
    const roster=root.value.querySelector('.enc-content')
    compactRoster.value=(roster?.clientWidth || available)<encounterPrimaryWidth
  }
  onMounted(()=>{observer=new ResizeObserver(measure);observer.observe(root.value);const roster=root.value.querySelector('.enc-content');if(roster)observer.observe(roster);measure()})
  onBeforeUnmount(()=>observer?.disconnect())
  return {hasColumns,compactRoster}
}
