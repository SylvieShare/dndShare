import { nextTick, onBeforeUnmount, onMounted, onUpdated, ref } from 'vue'

// Reset all queued names, measure together, then apply sizes. A long roster must
// not force one browser layout for every name during sidebar/window resizing.
const pendingFits=new Set()
let fitFrame=0
function enqueue(job){
  pendingFits.add(job)
  if(!fitFrame)fitFrame=requestAnimationFrame(()=>{
    fitFrame=0
    const jobs=[...pendingFits];pendingFits.clear()
    for(const entry of jobs)entry.reset()
    const sizes=jobs.map(entry=>entry.measure())
    jobs.forEach((entry,index)=>entry.apply(sizes[index]))
  })
}

export function useCreatureNameFit() {
  const nameRow=ref(null),nameText=ref(null),observed=new Set()
  let observer,disposed=false
  const job={
    reset(){if(!disposed&&nameText.value)nameText.value.style.fontSize='inherit'},
    measure(){
      const row=nameRow.value,text=nameText.value
      if(disposed||!row||!text||!row.clientWidth)return null
      const base=parseFloat(getComputedStyle(text.parentElement).fontSize)
      const children=[...row.children].filter(child=>child.getClientRects().length)
      const siblings=children.filter(child=>!child.contains(text))
      const gap=parseFloat(getComputedStyle(row).columnGap)||0
      const available=Math.max(0,row.clientWidth-siblings.reduce((sum,child)=>sum+child.getBoundingClientRect().width,0)-gap*(children.length-1))
      const natural=text.getBoundingClientRect().width
      return Math.min(base,Math.max(.1,base*(available-.5)/(natural||1)))
    },
    apply(size){if(!disposed&&nameText.value&&size!=null)nameText.value.style.fontSize=`${size}px`},
  }
  function schedule(){if(!disposed)enqueue(job)}
  function observe(){
    if(!observer)return
    const nodes=new Set([nameRow.value,...[...(nameRow.value?.children||[])].filter(child=>!child.contains(nameText.value))].filter(Boolean))
    for(const node of observed)if(!nodes.has(node)){observer.unobserve(node);observed.delete(node)}
    for(const node of nodes)if(!observed.has(node)){observer.observe(node);observed.add(node)}
  }
  onMounted(async()=>{
    await nextTick()
    if(disposed)return
    observer=new ResizeObserver(schedule);observe();schedule()
    document.fonts?.ready.then(schedule)
    document.fonts?.addEventListener?.('loadingdone',schedule)
  })
  onUpdated(()=>{observe();schedule()})
  onBeforeUnmount(()=>{
    disposed=true;observer?.disconnect();observed.clear();pendingFits.delete(job)
    if(!pendingFits.size){cancelAnimationFrame(fitFrame);fitFrame=0}
    document.fonts?.removeEventListener?.('loadingdone',schedule)
  })
  return {nameRow,nameText}
}
