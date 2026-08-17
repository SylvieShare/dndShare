<template>
  <EditorSection title="Восстановление">
    <p class="lre-copy">
      Хиты и ячейки заклинаний восстановятся полностью, ресурсы отдыха перезарядятся,
      истощение снизится на 1.
    </p>
  </EditorSection>

  <EditorSection title="Кости хитов">
    <p class="lre-copy">{{ recoveryCount === 0 ? 'Все кости уже доступны.' : `Автоматически восстановится ${recoveryCount} ${diceWord(recoveryCount)} хитов — столько разрешают правила длинного отдыха.` }}</p>
  </EditorSection>

  <div class="lre-actions">
    <button class="lre-btn lre-cancel" type="button" @click="$emit('cancel')">Отмена</button>
    <button class="lre-btn lre-confirm" type="button" @click="$emit('confirm')">
      Отдохнуть
    </button>
  </div>
</template>

<script setup>
import { EditorSection } from '@sylvieshare/share-ui'

const props = defineProps({
  hp: { type: Object, required: true },
  recoveryCount: { type: Number, required: true },
})
const emit = defineEmits(['confirm', 'cancel'])

function diceWord(count) { return count === 1 ? 'кость' : count < 5 ? 'кости' : 'костей' }
</script>

<style scoped>
.lre-copy { margin: 0; color: var(--text-2); font-size: 13px; line-height: 1.5; }
.lre-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.lre-btn { border: none; border-radius: 8px; padding: 12px 8px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.lre-btn:disabled { opacity: 0.35; cursor: default; }
.lre-cancel { background: var(--surface-raised); color: var(--text-2); }
.lre-confirm { background: color-mix(in srgb, var(--warning) 22%, transparent); color: var(--text-1); }
</style>
