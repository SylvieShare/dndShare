<template>
  <main class="edition-rules">
    <header>
      <p class="edition-rules-kicker">D&amp;D 5e · 2024</p>
      <h1>Правила 2024</h1>
      <p>Краткая памятка по изменениям. Точные условия способностей, предметов и заклинаний находятся в их карточках справочника.</p>
    </header>
    <nav aria-label="Разделы памятки">
      <a v-for="section in sections" :key="section.id" :href="`#${section.id}`">{{ section.title }}</a>
    </nav>
    <section v-for="section in sections" :id="section.id" :key="section.id">
      <h2>{{ section.title }}</h2>
      <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
    </section>
    <footer>
      <RouterLink to="/handbook">Открыть справочник</RouterLink>
      <a href="https://www.dndbeyond.com/posts/1810-updates-in-the-players-handbook-2024" target="_blank" rel="noopener noreferrer">Официальный обзор изменений</a>
    </footer>
  </main>
</template>

<script setup>
import { RouterLink } from 'vue-router'

const sections = [
  { id: 'origin', title: 'Создание персонажа', paragraphs: [
    'Предыстория задаёт три доступные характеристики: распределите +2/+1 либо по +1 ко всем трём. Она также даёт черту происхождения. Вид определяет собственные особенности, размер и скорость; прибавки характеристик 2014 к нему не добавляются.',
    'Подкласс выбирается на 3-м уровне. Комплект или деньги предыстории выбираются независимо от класса.',
  ] },
  { id: 'rest', title: 'Отдых и истощение', paragraphs: [
    'Продолжительный отдых восстанавливает все потраченные кости хитов. Каждый уровень истощения уменьшает результат тестов d20 на 2 и скорость на 5 футов. На 6-м уровне наступает смерть. Штрафы суммируются по числу уровней.',
    'Героическое вдохновение позволяет сразу после броска перебросить одну кость; используется новый результат.',
  ] },
  { id: 'spells', title: 'Заклинания', paragraphs: [
    'За один ход можно потратить только одну ячейку на сотворение заклинаний. Бесплатное сотворение не расходует эту возможность. Заклинания, реакции и особые разрешения читайте по тексту конкретной способности.',
    'Подготовка ограничена таблицей класса. У волшебника число заклинаний в книге и число подготовленных заклинаний различаются.',
  ] },
  { id: 'equipment', title: 'Оружие и доспехи', paragraphs: [
    'Мастерство оружия действует, когда способность персонажа разрешает использовать мастерство выбранного оружия. Его эффект описан в карточке оружия; само владение оружием этого эффекта не даёт.',
    'Щит без владения не увеличивает КД. Особенность дварфа 2014, позволявшая игнорировать требование Силы тяжёлого доспеха при расчёте скорости, к виду 2024 не относится.',
  ] },
  { id: 'compatibility', title: 'Старые книги и совместимость', paragraphs: [
    'У дополнения одна публикация, а совместимость определяется для каждой опции. Переизданные материалы Таши и Занатара используют версию PHB 2024. Непереизданные опции могут требовать адаптации.',
    'В карточках показана совместимость с выбранной редакцией. Прежнюю версию можно открыть для сравнения. Сохранённый персонаж использует свою редакцию независимо от глобального переключателя и редакции сессии.',
  ] },
]
</script>

<style scoped>
.edition-rules { max-width: 880px; margin: 0 auto; padding: 32px 20px 64px; color: var(--text-1); }
.edition-rules h1, .edition-rules h2 { font-family: var(--font-display); }
.edition-rules h1 { font-size: clamp(32px, 6vw, 48px); margin: 8px 0; }
.edition-rules p { font-family: var(--font-prose); line-height: 1.7; color: var(--text-2); }
.edition-rules .edition-rules-kicker { font-family: var(--font-ui); color: var(--accent); }
.edition-rules nav, .edition-rules footer { display: flex; flex-wrap: wrap; gap: 12px 24px; margin: 24px 0; }
.edition-rules a { color: var(--accent); }
.edition-rules section { padding-top: 12px; scroll-margin-top: calc(var(--header-h) + 12px); }
.edition-rules footer { border-top: 1px solid var(--border); padding-top: 24px; }
</style>
