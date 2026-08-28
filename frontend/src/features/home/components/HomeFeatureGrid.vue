<template>
  <section class="home-tools" aria-labelledby="home-tools-title">
    <header class="home-tools-heading">
      <div>
        <p class="home-section-kicker">Четыре пространства · один контекст</p>
        <h2 id="home-tools-title">Выберите, что нужно сейчас</h2>
      </div>
      <p>
        Начните с любого раздела: персонажи, материалы и история кампании
        останутся рядом по ходу игры.
      </p>
    </header>

    <div class="home-tools-grid">
      <RouterLink
        v-for="feature in features"
        :key="feature.key"
        class="home-feature-link"
        :class="'home-feature-link--' + feature.key"
        :to="feature.to"
      >
        <HomeFeatureCard :feature="feature" />
      </RouterLink>
    </div>
  </section>
</template>

<script setup>
import { BookOpen, ScrollText, Users, WandSparkles } from '@lucide/vue'
import HomeFeatureCard from '@/features/home/components/HomeFeatureCard.vue'

const features = Object.freeze([
  {
    key: 'sheet',
    to: '/chars',
    icon: Users,
    kind: 'Лист персонажа',
    title: 'Герой целиком — без перелистывания',
    description: 'Характеристики, ресурсы, заклинания, инвентарь и заметки живут в одном листе и меняются прямо во время игры.',
    action: 'Открыть персонажей',
    framed: true,
  },
  {
    key: 'wizard',
    to: '/chars/new',
    icon: WandSparkles,
    kind: 'Визард создания',
    title: 'Не заполняйте лист с нуля',
    description: 'Раса, класс, предыстория, характеристики и снаряжение — шаг за шагом, с проверкой важных выборов.',
    action: 'Собрать героя',
    tint: true,
  },
  {
    key: 'handbook',
    to: '/handbook',
    icon: BookOpen,
    kind: 'Справочник',
    title: 'Найдите нужное до следующего хода',
    description: 'Заклинания, способности, предметы и существа собраны по типам и доступны через быстрый поиск.',
    action: 'Искать в справочнике',
    tint: true,
  },
  {
    key: 'sessions',
    to: '/sessions',
    icon: ScrollText,
    kind: 'Сессии',
    title: 'Кампания не рассыпается по чатам',
    description: 'Сцены, участники, заметки, музыка и ход приключения остаются связаны в одном рабочем пространстве мастера и игроков.',
    action: 'Перейти к сессиям',
    framed: true,
  },
])
</script>

<style scoped>
.home-tools {
  padding-top: 34px;
}

.home-tools-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 28px;
  margin-bottom: 18px;
}

.home-section-kicker {
  margin: 0 0 7px;
  color: var(--accent-soft);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.home-tools-heading h2 {
  margin: 0;
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: clamp(28px, 3.5vw, 42px);
  font-weight: 650;
  letter-spacing: -0.015em;
  line-height: 1;
}

.home-tools-heading > p {
  max-width: 430px;
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.55;
  text-align: right;
}

.home-tools-grid {
  --home-feature-copy-width: 59%;
  --home-feature-description-width: 430px;
  --home-feature-min-height: 0px;
  --home-preview-display: block;
  --home-preview-flex-display: flex;
  --home-preview-opacity: 1;

  display: grid;
  grid-auto-rows: minmax(246px, auto);
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 14px;
}

.home-feature-link {
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.home-feature-link--sheet,
.home-feature-link--sessions {
  grid-column: span 7;
}

.home-feature-link--wizard,
.home-feature-link--handbook {
  grid-column: span 5;
}

@media (max-width: 1100px) {
  .home-tools-grid {
    --home-feature-copy-width: 100%;
    --home-feature-description-width: 360px;
    --home-preview-opacity: 0.22;
  }

  .home-feature-link--sheet,
  .home-feature-link--sessions,
  .home-feature-link--wizard,
  .home-feature-link--handbook {
    grid-column: span 6;
  }
}

@media (max-width: 900px) {
  .home-tools-grid {
    --home-feature-min-height: 230px;
    --home-preview-opacity: 0.35;

    grid-auto-rows: auto;
    grid-template-columns: 1fr;
  }

  .home-feature-link--sheet,
  .home-feature-link--sessions,
  .home-feature-link--wizard,
  .home-feature-link--handbook {
    grid-column: auto;
  }
}

@media (max-width: 700px) {
  .home-tools {
    padding-top: 28px;
  }

  .home-tools-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .home-tools-heading > p {
    max-width: 560px;
    text-align: left;
  }

  .home-tools-grid {
    --home-feature-description-width: 78%;
    --home-feature-min-height: 238px;
  }
}

@media (max-width: 420px) {
  .home-tools-grid {
    --home-feature-description-width: 100%;
    --home-feature-min-height: 260px;
    --home-preview-display: none;
    --home-preview-flex-display: none;
  }
}
</style>
