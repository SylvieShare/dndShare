<template>
  <section class="home-hero" aria-labelledby="home-title">
    <div class="home-hero-copy">
      <p class="home-kicker">
        <img src="/brand-mark.webp" alt="" aria-hidden="true" />
        DnD Share · мастерская для партии
      </p>
      <h1 id="home-title">От первого героя<br />до финальной сцены.</h1>
      <p class="home-lead">
        Соберите персонажа, ведите лист, находите нужное в справочнике и
        держите кампанию связной — без десятка вкладок и бумажек.
      </p>
      <div class="home-actions">
        <RouterLink class="home-action home-action--primary" to="/chars/new">
          Создать персонажа
          <ArrowRight :size="17" aria-hidden="true" />
        </RouterLink>
        <RouterLink class="home-action home-action--quiet" to="/handbook">
          Открыть справочник
        </RouterLink>
      </div>
    </div>

    <aside class="home-guide" aria-label="Подсказка Лиссары">
      <div class="home-guide-glow" aria-hidden="true" />
      <img
        class="home-guide-image"
        src="/static/mascots/lissara-knowing-coin.webp"
        alt="Лиссара, сереброволосая эльфийка, держит монету"
      />
      <div class="home-guide-note">
        <span>Лиссара рекомендует</span>
        <strong>Новый герой? Визард проведёт по шагам.</strong>
      </div>
    </aside>
  </section>
</template>

<script setup>
import { ArrowRight } from '@lucide/vue'
</script>

<style scoped>
.home-hero {
  min-height: 330px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 390px);
  align-items: center;
  gap: clamp(28px, 5vw, 72px);
  border-bottom: 1px solid var(--border);
}

.home-hero-copy {
  position: relative;
  z-index: 2;
  max-width: 760px;
  padding: 28px 0 38px;
}

.home-kicker {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 16px;
  color: var(--accent-soft);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.home-kicker img {
  width: 26px;
  height: 26px;
  object-fit: contain;
}

.home-hero h1 {
  margin: 0;
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: clamp(44px, 6vw, 76px);
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 0.92;
}

.home-lead {
  max-width: 670px;
  margin: 24px 0 0;
  color: var(--text-2);
  font-size: clamp(15px, 1.5vw, 18px);
  line-height: 1.62;
}

.home-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 27px;
}

.home-action {
  min-height: 42px;
  display: inline-flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 0 17px;
  border-radius: var(--r-md);
  color: var(--text-1);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
}

.home-action:hover {
  transform: translateY(-1px);
}

.home-action--primary {
  border: 1px solid var(--accent);
  background: var(--accent);
  color: var(--text-on-accent);
}

.home-action--primary:hover {
  border-color: var(--accent-hover);
  background: var(--accent-hover);
}

.home-action--quiet {
  border: 1px solid var(--border-strong);
  background: color-mix(in srgb, var(--surface) 76%, transparent);
}

.home-action--quiet:hover {
  border-color: color-mix(in srgb, var(--accent) 48%, var(--border-strong));
  background: var(--surface-raised);
}

.home-guide {
  position: relative;
  align-self: stretch;
  min-height: 330px;
  isolation: isolate;
}

.home-guide-glow {
  position: absolute;
  z-index: -1;
  right: 0;
  bottom: 22px;
  width: 290px;
  height: 250px;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--accent) 24%, transparent), transparent 68%);
  filter: blur(8px);
}

.home-guide-image {
  position: absolute;
  right: 7px;
  bottom: 0;
  width: auto;
  height: 330px;
  object-fit: contain;
  object-position: bottom right;
  filter: drop-shadow(0 18px 24px color-mix(in srgb, var(--bg) 65%, transparent));
}

.home-guide-note {
  position: absolute;
  z-index: 2;
  left: -16px;
  bottom: 30px;
  width: 188px;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--accent) 32%, var(--border));
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--popover-bg) 92%, transparent);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(12px);
}

.home-guide-note span,
.home-guide-note strong {
  display: block;
}

.home-guide-note span {
  margin-bottom: 5px;
  color: var(--accent-soft);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.home-guide-note strong {
  color: var(--text-1);
  font-size: 11px;
  line-height: 1.45;
}

@media (max-width: 900px) {
  .home-hero {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .home-guide {
    min-height: 250px;
  }

  .home-guide-image {
    height: 250px;
  }

  .home-guide-note {
    left: 0;
    bottom: 22px;
  }
}

@media (max-width: 700px) {
  .home-hero-copy {
    padding: 16px 0 22px;
  }

  .home-hero h1 {
    font-size: clamp(42px, 13vw, 62px);
  }

  .home-guide {
    min-height: 235px;
  }

  .home-guide-image {
    right: 2vw;
    height: 235px;
  }
}

@media (max-width: 420px) {
  .home-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .home-action {
    width: 100%;
  }

  .home-guide-note {
    width: 172px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-action {
    transition: none;
  }
}
</style>
