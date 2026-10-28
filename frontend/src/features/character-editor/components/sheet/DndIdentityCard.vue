<template>
  <div class="sheet-stack" :style="{ marginTop: compact ? 0 : '20px', gap: '11px' }">
    <CharacterBlock block-id="read_only_notice" />
    <div class="sheet-stack" style="flex-grow: 1; gap: 11px">
      <BaseTile :outlined="false" class="sheet-stack" style="padding: 0; overflow: hidden; align-items: stretch; gap: 0">
        <div class="sheet-row" style="align-items: stretch; gap: 0">
          <div class="sheet-stack" style="flex: 0 0 110px; gap: 0">
            <CharacterBlock block-id="character_icon" />
            <CharacterBlock block-id="desktop_status_trigger" />
          </div>
          <div class="sheet-stack" style="padding: 15px; flex-grow: 1; gap: 14px">
            <CharacterBlock block-id="char_identity" :options="{&quot;style&quot;:{&quot;min-width&quot;:&quot;0&quot;}}" />
            <CharacterBlock block-id="hp" :options="compactHealth ? { variant: 'compact' } : {}" />
          </div>
        </div>
        <CharacterBlock block-id="desktop_statuses" />
      </BaseTile>
    </div>
  </div>
</template>
<script setup>
import { BaseTile } from '@sylvieshare/share-ui'
import CharacterBlock from '../CharacterBlock.vue'
defineProps({ compact: Boolean, compactHealth: Boolean })
</script>
