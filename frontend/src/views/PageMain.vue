<template>
  <div class="landing-page">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">DnD Share</p>
        <h1>Сайт еще в разработке</h1>
        <p class="lead">
          Мы собираем удобный менеджер листов персонажей для партий D&amp;D:
          характеристики, заклинания, инвентарь и справочники будут жить в одном месте.
        </p>

      </div>

      <div class="sheet-preview" aria-hidden="true">
        <div class="preview-header">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div class="name-line"></div>
        <div class="stats-grid">
          <span v-for="index in 6" :key="index"></span>
        </div>
        <div class="preview-columns">
          <div>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: "PageMain",
}
</script>

<style scoped>
.landing-page {
  min-height: calc(100vh - 54px);
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 22%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 30%),
    linear-gradient(135deg, var(--app-bg) 0%, var(--surface) 48%, var(--app-bg) 100%);
}

.hero {
  width: min(1120px, calc(100% - 40px));
  min-height: calc(100vh - 54px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
  align-items: center;
  gap: 56px;
  padding: 56px 0 72px;
}

.hero-copy {
  max-width: 660px;
}

.eyebrow {
  margin: 0 0 14px;
  color: var(--accent-soft);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: var(--text-1);
  font-size: clamp(42px, 7vw, 78px);
  line-height: 0.98;
  font-weight: 800;
  letter-spacing: 0;
}

.lead {
  max-width: 600px;
  margin: 26px 0 0;
  color: var(--text-2);
  font-size: 19px;
  line-height: 1.6;
}

.sheet-preview {
  position: relative;
  min-height: 520px;
  padding: 28px;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 9%, transparent);
  border-radius: 8px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--text-on-accent) 5%, transparent), transparent),
    var(--surface);
  box-shadow: var(--shadow-lg);
}

.sheet-preview::before {
  content: "";
  position: absolute;
  inset: 16px;
  border: 1px solid color-mix(in srgb, var(--text-1) 8%, transparent);
  border-radius: 6px;
  pointer-events: none;
}

.preview-header,
.stats-grid,
.preview-columns {
  position: relative;
  z-index: 1;
}

.preview-header {
  display: flex;
  gap: 8px;
}

.preview-header span {
  width: 38px;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-1) 16%, transparent);
}

.name-line {
  position: relative;
  z-index: 1;
  width: 78%;
  height: 58px;
  margin-top: 34px;
  border-bottom: 2px solid color-mix(in srgb, var(--text-1) 22%, transparent);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 34px;
}

.stats-grid span {
  aspect-ratio: 1;
  border: 1px solid color-mix(in srgb, var(--text-1) 12%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg) 50%, transparent);
}

.preview-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-top: 26px;
}

.preview-columns div {
  display: grid;
  gap: 12px;
}

.preview-columns span {
  height: 42px;
  border-radius: 6px;
  background: var(--border);
}

@media (max-width: 820px) {
  .hero {
    grid-template-columns: 1fr;
    gap: 38px;
    align-items: start;
    padding-top: 44px;
  }

  .sheet-preview {
    min-height: 360px;
  }
}

@media (max-width: 520px) {
  .hero {
    width: min(100% - 28px, 1120px);
    padding-top: 36px;
  }

  h1 {
    font-size: 40px;
  }

  .lead {
    font-size: 16px;
  }

}
</style>
