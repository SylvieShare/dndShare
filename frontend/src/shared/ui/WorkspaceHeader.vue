<template>
  <header ref="element" class="workspace-header" :class="{ 'workspace-header--solid': solid, 'workspace-header--floating-navigation': navigationFloating, 'workspace-header--context': !!$slots.context, 'workspace-header--context-inline': contextInline, 'workspace-header--navigation-inline': navigationPlacement === 'inline' && navigationVisible }">
    <BlurBackdrop v-if="!solid" class="workspace-header-backdrop" radius="var(--chrome-blur)" />
    <div ref="main" class="workspace-header-inner" :class="{ 'workspace-header-inner--page': page }" :style="{ maxWidth: contentWidth || (page ? 'var(--layout-content-max)' : undefined) }">
    <div ref="identity" class="workspace-header-identity"><slot name="identity" /></div>
    <div :id="navigationId" v-show="navigationPlacement === 'inline' && navigationVisible" class="workspace-header-navigation" />
    <div v-if="$slots.context" ref="context" class="workspace-header-context"><slot name="context" /></div>
    <div ref="actions" class="workspace-header-actions"><slot name="actions" /><LocalDataStatus /></div>
    </div>
    <slot name="between" />
    <Teleport :to="navigationTarget || '#' + navigationId" :disabled="!navigationTarget && navigationPlacement !== 'inline'" defer>
      <WorkspaceSubheader ref="navigation" v-if="$slots.navigation" v-show="navigationVisible" :inline="!!navigationTarget || navigationPlacement === 'inline'" :floating="navigationFloating" :fit="fitNavigation" :content-width="contentWidth || (page ? 'var(--layout-content-max)' : undefined)"><slot name="navigation" /></WorkspaceSubheader>
    </Teleport>
  </header>
</template>
<script setup>
import LocalDataStatus from '@/platform/LocalDataStatus.vue'
import { BlurBackdrop } from '@sylvieshare/share-ui'
import WorkspaceSubheader from './WorkspaceSubheader.vue'
import { useWorkspaceContextLayout } from '@/shared/composables/useWorkspaceContextLayout'
import { useWorkspaceScrollPosition } from '@/shared/composables/useWorkspaceScrollPosition'
import { layoutTokens } from '@/app/design-tokens'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
const props = defineProps({ page: Boolean, contentWidth: String, fitNavigation: {type:Boolean,default:true}, solid: {type:Boolean,default:true}, navigationVisible:{type:Boolean,default:true}, navigationPlacement:{type:String,default:'below'}, navigationTarget:Object, navigationFloating:Boolean, scrollSource:{type:Object,default:undefined}, contextPlacement:{type:String,default:'auto'} });
const navigationId = `workspace-navigation-${useId()}`
const element = ref(null),
  emit = defineEmits(["resize"]);
const main=ref(null), identity=ref(null), context=ref(null), actions=ref(null), navigation=ref(null)
const contextInline=useWorkspaceContextLayout(main,identity,context,actions,props)
watch([()=>props.navigationPlacement,()=>props.navigationTarget],async()=>{
  const focused=document.activeElement
  if(!navigation.value?.$el?.contains(focused))return
  await nextTick()
  if(focused.isConnected && (document.activeElement===document.body || document.activeElement===focused)) {
    focused.focus({preventScroll:true})
    focused.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'})
  }
},{flush:'sync'})
function setScrollPosition(value) {
  const scroll=Math.max(0,Number(value)||0)
  element.value?.toggleAttribute('data-workspace-scrolled',scroll>0)
  element.value?.style.setProperty('--workspace-scroll-depth',String(Math.min(1,scroll/layoutTokens['workspace-header-shadow-distance'])))
}
useWorkspaceScrollPosition(computed(()=>element.value && {setScrollPosition}),()=>props.scrollSource === undefined ? (typeof window==='undefined'?null:window) : props.scrollSource)
defineExpose({setScrollPosition})
let observer;
function updateSize() {
  if (!element.value || !main.value) return
  const style = getComputedStyle(main.value)
  const contextStyle = context.value ? getComputedStyle(context.value) : null
  const left = main.value.offsetLeft + parseFloat(style.paddingLeft) + parseFloat(contextStyle?.paddingLeft || 0)
  const right = element.value.clientWidth - main.value.offsetLeft - main.value.offsetWidth + parseFloat(style.paddingRight) + parseFloat(contextStyle?.paddingRight || 0)
  const start = style.direction === 'rtl' ? right : left
  const end = style.direction === 'rtl' ? left : right
  element.value.style.setProperty('--workspace-context-inset-start', `${Math.max(0, start)}px`)
  element.value.style.setProperty('--workspace-context-inset-end', `${Math.max(0, end)}px`)
  element.value.style.setProperty('--workspace-main-height', `${main.value.offsetHeight}px`)
  emit('resize', element.value.offsetHeight)
}
onMounted(() => {
  observer = new ResizeObserver(updateSize);
  observer.observe(element.value);
  observer.observe(main.value);
  updateSize();
});
onBeforeUnmount(() => observer?.disconnect());
</script>
<style scoped>
:global(html[data-platform="android"] .workspace-header) { padding-top:var(--native-safe-top, 0px); }
.workspace-header {
  position: relative;
  z-index: 20;
  flex: none;
  --workspace-main-height: var(--layout-header);
  isolation: isolate;
  background: transparent;
}
.workspace-header-backdrop {
  --blur-backdrop-inset: 0 0 calc(-1 * var(--chrome-fade-tail));
  --blur-backdrop-background: color-mix(in srgb, var(--bg) calc(var(--chrome-tint) * 100%), transparent);
  --blur-backdrop-mask: linear-gradient(to bottom, var(--text-on-accent) var(--workspace-main-height), transparent 100%);
  z-index: 0;
}

.workspace-header-inner {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--spacing-medium) var(--workspace-header-column-gap, var(--spacing-medium));
  min-height: var(--layout-header);
  box-sizing: border-box;
  width: 100%;
  margin-inline: auto;
  padding: var(--spacing-small) var(--spacing-page);
  transition: max-width var(--motion-navigation);
}
.workspace-header-inner--page { padding-inline: var(--spacing-page); }
.workspace-header-identity {
  min-width: 0;
  min-height: calc(var(--layout-header) - 2 * var(--spacing-small) - var(--layout-border));
  display: flex;
  align-items: center;
  gap: var(--workspace-header-identity-gap, 0px);
}
.workspace-header-actions {
  min-width: 0;
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 10px;
}
.workspace-header-navigation { display:flex;align-items:center;justify-content:center;min-width:0; }
@container (max-width:1100px) {
  .workspace-header-inner {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px var(--workspace-header-column-gap, 14px);
  }
}
@media (--ui-compact) {
  .workspace-header-inner {
    grid-template-columns: minmax(0, 1fr) auto;
    padding-inline: var(--spacing-page);
  }
}
@media (--ui-compact) { .workspace-header-inner--page { padding-inline: var(--spacing-large); } }
@media (--ui-phone) { .workspace-header-inner--page { padding-inline: var(--spacing-small); } }
@media (--ui-phone) {
  .workspace-header-inner {padding-inline:var(--spacing-small)}
  .workspace-header-context {padding-inline:var(--spacing-medium)}
}
@media (--ui-compact) {
  .workspace-header { background: transparent; border: 0; box-shadow: none; }
  .workspace-header-inner { min-height: var(--layout-header); }
}
@media (prefers-reduced-motion: reduce) { .workspace-header-inner { transition: none; } }
.workspace-header--solid {background:var(--workspace-header-background, var(--subheader));border:0;box-shadow:none}
.workspace-header--floating-navigation { --workspace-header-background:linear-gradient(to bottom,var(--subheader) calc(var(--workspace-main-height) + var(--native-safe-top,0px)),transparent 0); }
.workspace-header::after {content:'';position:absolute;z-index:2;top:100%;left:0;right:0;height:var(--layout-workspace-header-shadow-height);background:linear-gradient(to bottom,color-mix(in srgb,var(--scrim) 28%,transparent),transparent);opacity:var(--workspace-scroll-depth,0);pointer-events:none;transition:opacity var(--motion-feedback);}
.workspace-header--floating-navigation::after {top:calc(var(--workspace-main-height) + var(--native-safe-top,0px));}
.workspace-header:not([data-workspace-scrolled])::after {visibility:hidden;opacity:0;transition:none;}
.workspace-header--context .workspace-header-identity {grid-column:1;grid-row:1}
.workspace-header--context .workspace-header-inner {row-gap:var(--workspace-header-context-gap,var(--spacing-xs))}
.workspace-header--context .workspace-header-actions {grid-column:-2/-1;grid-row:1}
.workspace-header-context {grid-column:1/-1;grid-row:2;min-width:0}
.workspace-header--context-inline .workspace-header-inner {grid-template-columns:max-content minmax(0,1fr) auto}
.workspace-header--context-inline .workspace-header-context {grid-column:2;grid-row:1;margin-inline-start:var(--workspace-context-inline-offset,0px)}
.workspace-header--context-inline .workspace-header-identity {max-width:100%}
.workspace-header--navigation-inline .workspace-header-inner {grid-template-columns:fit-content(var(--layout-workspace-inline-identity-max)) minmax(0,1fr) auto}
@media (prefers-reduced-motion:reduce) {.workspace-header::after{transition:none}}
</style>
