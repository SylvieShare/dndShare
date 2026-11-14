<template>
  <div class="sheet-stack" style="gap: 15px">
    <BaseTile :outlined="false" class="sheet-grid dnd-utility-grid">
      <CharacterBlock block-id="armor" :options="{&quot;variant&quot;:&quot;tile&quot;,&quot;embedded&quot;:true}" />
    </BaseTile>
    <CharacterBlock block-id="lvl" :options="{&quot;height&quot;:&quot;64px&quot;}" />
  </div>
</template>
<script setup>
import { BaseTile } from '@sylvieshare/share-ui'
import CharacterBlock from '../CharacterBlock.vue'
</script>
<style scoped>
.dnd-utility-grid { grid-auto-rows: 70px; overflow: hidden; width: 100%; gap: 0; grid-template-columns: minmax(0, 1fr); }
</style>
