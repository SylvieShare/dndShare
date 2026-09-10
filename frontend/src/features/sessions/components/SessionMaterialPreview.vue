<template>
        <div class="material-preview-stage" :class="[`material-preview-stage--${material.kind}`, material.kind === 'note' ? `material-note--${material.noteStyle}` : '']">
          <img v-if="material.kind === 'image' || material.kind === 'map'" :src="material.assetUrl" :alt="material.name" />
          <video v-else-if="material.kind === 'video'" :src="material.assetUrl" controls playsinline preload="metadata" />
          <article v-else class="material-copy-content">{{ material.content }}</article>
        </div>
</template>
<script setup>
defineProps({ material: { type: Object, required: true } })
</script>
<style scoped>
.material-preview-stage { width: min(900px, 100%); max-height: 58vh; display: grid; align-self: center; place-items: center; overflow: auto; border: 1px solid var(--border); border-radius: 14px; background: var(--bg); box-shadow: 0 18px 55px color-mix(in srgb, var(--bg) 55%, transparent); }.material-preview-stage img, .material-preview-stage video { max-width: 100%; max-height: 58vh; display: block; object-fit: contain; }.material-preview-stage video { width: 100%; }.material-copy-content { box-sizing: border-box; width: 100%; min-height: 280px; padding: clamp(28px, 5vw, 72px); color: var(--text-1); font-family: var(--font-prose); font-size: clamp(19px, 2vw, 31px); line-height: 1.65; white-space: pre-wrap; }.material-preview-stage--note { max-width: 720px; border-radius: 5px; }.material-note--parchment { background: var(--material-note-parchment-bg); color: var(--material-note-parchment-text); }.material-note--letter { background: var(--material-note-letter-bg); color: var(--material-note-letter-text); }.material-note--dossier { background: var(--material-note-dossier-bg); color: var(--material-note-dossier-text); box-shadow: inset 0 0 0 8px var(--material-note-dossier-border), var(--shadow-lg); }.material-note--arcane { border-color: color-mix(in srgb, var(--accent) 65%, var(--border)); background: radial-gradient(circle at 50% 20%, var(--material-note-arcane-glow), var(--material-note-arcane-bg) 72%); color: var(--material-note-arcane-text); }.material-note--parchment .material-copy-content, .material-note--letter .material-copy-content, .material-note--dossier .material-copy-content, .material-note--arcane .material-copy-content { color: inherit; }
</style>
