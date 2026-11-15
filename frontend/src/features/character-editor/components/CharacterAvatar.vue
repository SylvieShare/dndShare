<template>
  <AvatarFrame class="character-avatar" :src="src || ''" :size="size" radius="var(--radius-input)" position="center top" :label="label">
    <span v-if="name" class="character-avatar-initial">{{ Array.from(name.trim())[0]?.toUpperCase() || '?' }}</span>
    <UserRound v-else :size="20" :stroke-width="1.5" />
  </AvatarFrame>
</template>
<script setup>
import { AvatarFrame } from '@sylvieshare/share-ui'
import { UserRound } from '@lucide/vue'
defineProps({ src:String, name:String, size:{type:[Number,String],default:48}, label:{type:String,default:''} })
</script>
<style scoped>
.character-avatar { color:var(--accent-soft); }
.character-avatar-initial { font:inherit; font-weight:700; }
</style>
