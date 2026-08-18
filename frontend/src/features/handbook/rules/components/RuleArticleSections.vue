<template>
  <div class="rule-article-sections">
    <section
      v-for="section in article.sections"
      :id="section.id"
      :key="section.id"
      class="rule-article-section"
    >
      <h2>
        <a class="rule-section-anchor" :href="`#${section.id}`" :aria-label="`Ссылка на раздел «${section.title}»`">#</a>
        {{ section.title }}
      </h2>

      <p v-if="section.lead" class="rule-section-lead">{{ section.lead }}</p>

      <RuleVisualRenderer v-if="section.visual" :name="section.visual" />

      <p v-for="paragraph in section.paragraphs || []" :key="paragraph" class="rule-paragraph">
        {{ paragraph }}
      </p>

      <BaseTile v-if="section.formula" class="rule-formula" color="var(--warning)" tint>
        <Calculator aria-hidden="true" />
        <strong>{{ section.formula }}</strong>
      </BaseTile>

      <ul v-if="section.bullets?.length" class="rule-bullets">
        <li v-for="bullet in section.bullets" :key="bullet">{{ bullet }}</li>
      </ul>

      <ol v-if="section.steps?.length" class="rule-steps">
        <li v-for="(step, index) in section.steps" :key="step.title">
          <BaseTile class="rule-step" :color="article.accent" tint>
            <span class="rule-step-number">{{ index + 1 }}</span>
            <span>
              <strong>{{ step.title }}</strong>
              <span>{{ step.text }}</span>
            </span>
          </BaseTile>
        </li>
      </ol>

      <BaseTile v-if="section.example" class="rule-example" color="var(--info)" tint>
        <span class="rule-callout-label"><MessageCircle aria-hidden="true" /> {{ section.example.title }}</span>
        <p>{{ section.example.text }}</p>
      </BaseTile>

      <BaseTile v-if="section.note" class="rule-note" color="var(--warning)" strip>
        <span class="rule-callout-label"><Lightbulb aria-hidden="true" /> Запомни</span>
        <p>{{ section.note }}</p>
      </BaseTile>
    </section>
  </div>
</template>

<script setup>
import { Calculator, Lightbulb, MessageCircle } from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import RuleVisualRenderer from '@/features/handbook/rules/visuals/RuleVisualRenderer'

defineProps({
  article: { type: Object, required: true },
})
</script>

<style scoped>
.rule-article-sections {
  display: flex;
  flex-direction: column;
  gap: 58px;
}

.rule-article-section {
  scroll-margin-top: 24px;
}

.rule-article-section h2 {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 12px;
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: clamp(24px, 3vw, 34px);
  line-height: 1.15;
}

.rule-section-anchor {
  color: var(--accent);
  font-family: var(--font-ui);
  font-size: 14px;
  text-decoration: none;
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity .15s, transform .15s;
}

.rule-article-section:hover .rule-section-anchor,
.rule-section-anchor:focus-visible {
  opacity: .8;
  transform: translateX(0);
}

.rule-section-lead {
  max-width: 760px;
  margin: 0 0 22px;
  color: var(--text-2);
  font-family: var(--font-prose);
  font-size: 17px;
  line-height: 1.65;
}

.rule-paragraph {
  max-width: 780px;
  margin: 13px 0 0;
  color: var(--text-2);
  font-family: var(--font-prose);
  font-size: 15px;
  line-height: 1.72;
}

.rule-bullets {
  max-width: 800px;
  display: grid;
  gap: 12px;
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
}

.rule-bullets li {
  position: relative;
  padding-left: 24px;
  color: var(--text-2);
  font-family: var(--font-prose);
  font-size: 15px;
  line-height: 1.65;
}

.rule-bullets li::before {
  position: absolute;
  top: .72em;
  left: 4px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--rule-accent, var(--accent));
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--rule-accent, var(--accent)) 13%, transparent);
  content: '';
}

.rule-formula {
  width: fit-content;
  max-width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
  padding: 13px 16px;
  color: var(--text-1);
  box-sizing: border-box;
}

.rule-formula svg { width: 18px; color: var(--warning); }

.rule-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 22px 0 0;
  padding: 0;
  list-style: none;
}

.rule-step {
  min-height: 100%;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  padding: 16px;
}

.rule-step-number {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--text-on-accent);
  background: var(--rule-accent, var(--accent));
  font-size: 12px;
  font-weight: 800;
}

.rule-step strong,
.rule-step span span { display: block; }
.rule-step strong { margin-bottom: 5px; color: var(--text-1); }
.rule-step span span { color: var(--text-2); font-family: var(--font-prose); font-size: 13px; line-height: 1.5; }

.rule-example,
.rule-note {
  max-width: 780px;
  margin-top: 20px;
  padding: 16px 18px;
}

.rule-callout-label {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-1);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.rule-callout-label svg { width: 16px; height: 16px; color: var(--tile-color); }
.rule-example p,
.rule-note p { margin: 8px 0 0; color: var(--text-2); font-family: var(--font-prose); font-size: 14px; line-height: 1.6; }

@media (max-width: 720px) {
  .rule-article-sections { gap: 42px; }
  .rule-section-anchor { display: none; }
  .rule-section-lead { font-size: 15px; }
  .rule-steps { grid-template-columns: 1fr; }
}
</style>
