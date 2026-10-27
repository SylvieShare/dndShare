<template>
  <div class="sheet-stack" style="gap: 15px">
    <BaseTile class="sheet-grid dnd-utility-grid">
      <CharacterBlock block-id="armor" :options="{&quot;variant&quot;:&quot;tile&quot;,&quot;embedded&quot;:true}" />
      <CharacterBlock block-id="initiative" :options="{&quot;variant&quot;:&quot;tile&quot;,&quot;embedded&quot;:true}" />
      <CharacterBlock block-id="settings" :options="{&quot;embedded&quot;:true}" />
      <CharacterBlock block-id="speed" :options="{&quot;variant&quot;:&quot;tile&quot;,&quot;embedded&quot;:true}" />
      <CharacterBlock block-id="prof_bonus" :options="{&quot;variant&quot;:&quot;tile&quot;,&quot;embedded&quot;:true}" />
      <CharacterBlock block-id="rest" :options="{&quot;embedded&quot;:true}" />
    </BaseTile>
    <CharacterBlock block-id="lvl" :options="{&quot;height&quot;:&quot;64px&quot;}" />
  </div>
</template>
<script setup>
import { BaseTile } from '@sylvieshare/share-ui'
import CharacterBlock from '../CharacterBlock.vue'
</script>
<style scoped>
.dnd-utility-grid { grid-auto-rows: 70px; overflow: hidden; width: 100%; gap: 0; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.dnd-utility-grid :deep(> :nth-child(n + 4)) { border-top: 1px solid var(--border); }
.dnd-utility-grid :deep(> :not(:nth-child(3n + 1))) { border-left: 1px solid var(--border); }
</style>
