<template>
  <main class="rules-unavailable">
    <section class="rules-unavailable-card">
      <span class="rules-unavailable-icon"><BookOpenCheck aria-hidden="true" /></span>
      <p class="rules-unavailable-kicker">{{ systemName }} · {{ version }}</p>
      <h1>Правила этой редакции готовятся</h1>
      <p>
        У этой системы отдельная страница и собственный адрес. Мы не показываем
        здесь правила другой редакции, чтобы за столом не смешивались механики.
      </p>
      <div class="rules-unavailable-actions">
        <RouterLink class="rules-unavailable-primary" to="/handbook">Открыть справочник</RouterLink>
        <RouterLink class="rules-unavailable-secondary" to="/">На главную</RouterLink>
      </div>
    </section>
  </main>
</template>

<script setup>
import { BookOpenCheck } from '@lucide/vue'
import { RouterLink } from 'vue-router'

defineProps({
  systemName: { type: String, required: true },
  version: { type: String, required: true },
})
</script>

<style scoped>
.rules-unavailable {
  box-sizing: border-box;
  min-height: calc(100vh - var(--header-h));
  display: grid;
  place-items: center;
  padding: 32px 20px;
  background:
    radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 34%),
    var(--bg);
}

.rules-unavailable-card {
  width: min(620px, 100%);
  padding: clamp(28px, 6vw, 56px);
  border: 1px solid var(--border-strong);
  border-radius: 22px;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  text-align: center;
}

.rules-unavailable-icon {
  width: 68px;
  height: 68px;
  display: inline-grid;
  place-items: center;
  border-radius: 20px;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
}

.rules-unavailable-icon svg { width: 34px; height: 34px; }

.rules-unavailable-kicker {
  margin: 22px 0 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.rules-unavailable h1 {
  margin: 0;
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: clamp(32px, 6vw, 48px);
  line-height: 1;
}

.rules-unavailable p:not(.rules-unavailable-kicker) {
  max-width: 500px;
  margin: 18px auto 0;
  color: var(--text-2);
  font-family: var(--font-prose);
  line-height: 1.65;
}

.rules-unavailable-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 28px;
}

.rules-unavailable-actions a {
  padding: 10px 15px;
  border: 1px solid var(--border-strong);
  border-radius: 9px;
  color: var(--text-1);
  font-weight: 700;
  text-decoration: none;
}

.rules-unavailable-primary {
  border-color: var(--accent) !important;
  background: var(--accent);
  color: var(--text-on-accent) !important;
}

@media (max-width: 480px) {
  .rules-unavailable-actions { flex-direction: column; }
}
</style>
