<template>
  <div class="player-rules" :style="article ? { '--rule-accent': article.accent } : {}">
    <div class="rules-layout">
      <aside class="rules-toc" aria-label="Разделы правил">
        <RouterLink class="rules-toc-home" :to="{ name: 'PlayerRules' }">
          <BookOpenCheck aria-hidden="true" />
          <span>Как играть</span>
          <span class="rules-version">2014</span>
        </RouterLink>

        <nav class="rules-toc-links">
          <RouterLink
            v-for="entry in PLAYER_RULE_ARTICLES"
            :key="entry.slug"
            class="rules-toc-link"
            :to="ruleUrl(entry)"
          >
            <span class="rules-toc-order">{{ entry.order }}</span>
            <span>{{ entry.shortTitle }}</span>
          </RouterLink>
        </nav>

        <RouterLink class="rules-toc-handbook" to="/handbook">
          <Library aria-hidden="true" /> Открыть справочник
        </RouterLink>
      </aside>

      <main class="rules-main">
        <template v-if="article">
          <article class="rule-article">
            <header class="rule-article-header">
              <div class="rule-article-kicker">
                <span>D&amp;D 5e · 2014</span>
                <span><Clock3 aria-hidden="true" /> {{ article.readingMinutes }} мин</span>
              </div>
              <div class="rule-article-title-row">
                <span class="rule-article-icon"><RuleIcon :name="article.icon" /></span>
                <div>
                  <p class="rule-article-number">Раздел {{ article.order }} из {{ PLAYER_RULE_ARTICLES.length }}</p>
                  <h1>{{ article.title }}</h1>
                </div>
              </div>
              <p class="rule-article-summary">{{ article.summary }}</p>
              <div class="rule-article-jump" aria-label="Содержание статьи">
                <a v-for="section in article.sections" :key="section.id" :href="`#${section.id}`">
                  {{ section.title }}
                </a>
              </div>
            </header>

            <RuleArticleSections :article="article" />

            <nav class="rule-next-nav" aria-label="Соседние разделы">
              <RouterLink v-if="previousArticle" class="rule-neighbour" :to="ruleUrl(previousArticle)">
                <ArrowLeft aria-hidden="true" />
                <span><small>Назад</small>{{ previousArticle.shortTitle }}</span>
              </RouterLink>
              <RouterLink v-if="nextArticle" class="rule-neighbour rule-neighbour--next" :to="ruleUrl(nextArticle)">
                <span><small>Дальше</small>{{ nextArticle.shortTitle }}</span>
                <ArrowRight aria-hidden="true" />
              </RouterLink>
            </nav>
          </article>
        </template>

        <template v-else>
          <section class="rules-landing">
            <div v-if="unknownSlug" class="rules-missing" role="status">
              Такой раздел не найден. Ниже — все доступные правила редакции 2014.
            </div>

            <header class="rules-hero">
              <div class="rules-hero-copy">
                <span class="rules-eyebrow"><Sparkles aria-hidden="true" /> Помощник игрока</span>
                <h1>Как играть в D&amp;D</h1>
                <p>Короткие ответы, понятные примеры и схемы на данных персонажа. Начни с основ или найди правило для ситуации за столом.</p>
              </div>
              <div class="rules-hero-die" aria-hidden="true">
                <SystemDie :sides="20" :value="20" :size="118" :animated="false" />
                <span>D&amp;D 5e</span>
                <strong>2014</strong>
              </div>
            </header>

            <label class="rules-search">
              <Search aria-hidden="true" />
              <input v-model="query" type="search" placeholder="Например: что можно сделать в свой ход" />
              <span v-if="query" class="rules-search-count">{{ filteredArticles.length }}</span>
            </label>

            <div v-if="filteredArticles.length" class="rules-card-grid">
              <RouterLink
                v-for="entry in filteredArticles"
                :key="entry.slug"
                class="rules-card-link"
                :to="ruleUrl(entry)"
              >
                <BaseTile class="rules-card" :color="entry.accent" interactive tint>
                  <div class="rules-card-top">
                    <span class="rules-card-icon"><RuleIcon :name="entry.icon" /></span>
                    <span class="rules-card-order">0{{ entry.order }}</span>
                  </div>
                  <div>
                    <h2>{{ entry.shortTitle }}</h2>
                    <p>{{ entry.summary }}</p>
                  </div>
                  <span class="rules-card-meta">{{ entry.readingMinutes }} мин <ArrowUpRight aria-hidden="true" /></span>
                </BaseTile>
              </RouterLink>
            </div>
            <BaseTile v-else class="rules-no-results" color="var(--warning)" tint>
              <SearchX aria-hidden="true" />
              <div><strong>Ничего не нашли</strong><span>Попробуй более короткий запрос: «хиты», «ход» или «концентрация».</span></div>
            </BaseTile>
          </section>
        </template>

        <RulesLicense />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  Clock3,
  Library,
  Search,
  SearchX,
  Sparkles,
} from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import RuleArticleSections from '@/features/handbook/rules/components/RuleArticleSections'
import RuleIcon from '@/features/handbook/rules/components/RuleIcon'
import RulesLicense from '@/features/handbook/rules/components/RulesLicense'
import {
  findPlayerRule,
  PLAYER_RULE_ARTICLES,
  searchPlayerRules,
} from '@/features/handbook/rules/lib/playerRules'
import SystemDie from '@/shared/ui/SystemDie'
import { useUiStore } from '@/stores/ui'

const route = useRoute()
const uiStore = useUiStore()
const query = ref('')
const headerOwner = String(route.name)

const requestedSlug = computed(() => String(route.params.articleSlug || ''))
const article = computed(() => requestedSlug.value ? findPlayerRule(requestedSlug.value) : null)
const unknownSlug = computed(() => !!requestedSlug.value && !article.value)
const routeScrollTarget = computed(() => `${requestedSlug.value}${route.hash || ''}`)
const filteredArticles = computed(() => searchPlayerRules(query.value))
const articleIndex = computed(() => article.value ? PLAYER_RULE_ARTICLES.indexOf(article.value) : -1)
const previousArticle = computed(() => articleIndex.value > 0 ? PLAYER_RULE_ARTICLES[articleIndex.value - 1] : null)
const nextArticle = computed(() => articleIndex.value >= 0 ? PLAYER_RULE_ARTICLES[articleIndex.value + 1] || null : null)

function ruleUrl(entry) {
  return { name: 'PlayerRuleArticle', params: { articleSlug: entry.slug } }
}

watch(article, value => {
  uiStore.setHeaderContext({ title: value?.shortTitle || 'Как играть' }, headerOwner)
}, { immediate: true })

watch(routeScrollTarget, async () => {
  await nextTick()
  const anchorId = String(route.hash || '').replace(/^#/, '')
  const target = anchorId ? document.getElementById(anchorId) : null
  if (target) target.scrollIntoView({ block: 'start' })
  else window.scrollTo({ top: 0, left: 0 })
}, { immediate: true })

onBeforeUnmount(() => uiStore.clearHeaderContext(headerOwner))
</script>

<style scoped src="./styles/ViewPlayerRules.css"></style>
