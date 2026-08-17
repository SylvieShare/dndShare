<template>
  <footer class="rules-license">
    <div class="rules-license-heading"><Scale aria-hidden="true" /> Источник и лицензия</div>
    <p>
      Русский текст этого раздела — краткая неофициальная адаптация правил для интерфейса DnD Share.
      При споре сверяйтесь с
      <a href="https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf" target="_blank" rel="noreferrer">SRD 5.1</a>.
    </p>
    <p lang="en" class="rules-attribution">
      This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at
      <a href="https://dnd.wizards.com/resources/systems-reference-document" target="_blank" rel="noreferrer">dnd.wizards.com/resources/systems-reference-document</a>.
      The SRD 5.1 is licensed under the
      <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noreferrer">Creative Commons Attribution 4.0 International License</a>.
    </p>
  </footer>
</template>

<script setup>
import { Scale } from '@lucide/vue'
</script>

<style scoped>
.rules-license {
  margin-top: 64px;
  padding-top: 22px;
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.6;
}

.rules-license-heading {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 700;
}

.rules-license-heading svg { width: 15px; height: 15px; }
.rules-license p { max-width: 860px; margin: 6px 0; }
.rules-license a { color: var(--accent-soft); }
.rules-attribution { opacity: .82; }
</style>
