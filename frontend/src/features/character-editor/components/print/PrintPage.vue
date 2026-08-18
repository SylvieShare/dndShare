<template>
  <section class="sheet-page" :class="{ 'sheet-page--message': message }">
    <span class="corner corner--tl" aria-hidden="true"></span>
    <span class="corner corner--tr" aria-hidden="true"></span>
    <span class="corner corner--bl" aria-hidden="true"></span>
    <span class="corner corner--br" aria-hidden="true"></span>

    <div class="sheet-content">
      <header v-if="title" class="sheet-heading">
        <div class="sheet-heading-mark" aria-hidden="true">
          <span>{{ number }}</span>
        </div>
        <div class="sheet-heading-copy">
          <div class="sheet-kicker">DnD Share · печатный лист</div>
          <h2>{{ title }}</h2>
        </div>
        <div class="sheet-heading-rule" aria-hidden="true"><i></i></div>
      </header>

      <slot />
    </div>

    <footer v-if="number" class="sheet-footer" aria-hidden="true">
      <span>✦</span><i></i><span>{{ number }}</span><i></i><span>✦</span>
    </footer>
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  number: { type: [String, Number], default: '' },
  message: Boolean,
})
</script>

<style scoped>
.sheet-page {
  position: relative;
  width: min(210mm, 100%);
  min-height: 297mm;
  margin: 0 auto 18px;
  padding: 12mm 13mm 14mm;
  overflow: hidden;
  background:
    radial-gradient(circle at 14% 8%, rgba(116, 87, 45, .035), transparent 22%),
    radial-gradient(circle at 87% 91%, rgba(116, 87, 45, .03), transparent 24%),
    #fffefa;
  box-shadow: 0 18px 55px rgba(34, 32, 27, .15);
  color: #201d19;
}
.sheet-page::before,
.sheet-page::after {
  content: '';
  position: absolute;
  pointer-events: none;
}
.sheet-page::before {
  inset: 5mm;
  border: 1px solid #72634d;
}
.sheet-page::after {
  inset: 6.3mm;
  border: .35px solid #baaa8d;
}
.sheet-page--message { display: grid; place-items: center; }
.sheet-content { position: relative; z-index: 1; min-width: 0; }
.corner { position: absolute; z-index: 2; width: 11mm; height: 11mm; pointer-events: none; }
.corner::before,
.corner::after { content: ''; position: absolute; background: #72634d; }
.corner::before { width: 9mm; height: .5px; top: 1.5mm; left: 1.5mm; }
.corner::after { width: .5px; height: 9mm; top: 1.5mm; left: 1.5mm; }
.corner--tl { top: 3.5mm; left: 3.5mm; }
.corner--tr { top: 3.5mm; right: 3.5mm; transform: rotate(90deg); }
.corner--br { right: 3.5mm; bottom: 3.5mm; transform: rotate(180deg); }
.corner--bl { left: 3.5mm; bottom: 3.5mm; transform: rotate(270deg); }
.sheet-heading { display: grid; grid-template-columns: 12mm auto 1fr; align-items: center; gap: 3mm; margin: 0 0 6mm; }
.sheet-heading-mark { width: 11mm; height: 11mm; display: grid; place-items: center; border: 1px solid #72634d; transform: rotate(45deg); }
.sheet-heading-mark::before { content: ''; position: absolute; inset: 1.2mm; border: .4px solid #baaa8d; }
.sheet-heading-mark span { position: relative; z-index: 1; transform: rotate(-45deg); font: 700 7px/1 var(--font-print-display); color: #72634d; }
.sheet-heading-copy { min-width: 0; }
.sheet-kicker { margin-bottom: 1mm; font: 700 6px/1 var(--font-print-ui); letter-spacing: .18em; text-transform: uppercase; color: #8a7a61; }
.sheet-heading h2 { margin: 0; font: 700 21px/1 var(--font-print-display); letter-spacing: .015em; }
.sheet-heading-rule { display: flex; align-items: center; margin-left: 2mm; }
.sheet-heading-rule::before,
.sheet-heading-rule::after { content: '◆'; font-size: 5px; color: #8a7a61; }
.sheet-heading-rule i { flex: 1; height: 1px; margin: 0 1.5mm; background: linear-gradient(90deg, #8a7a61, #d8cdb8); }
.sheet-footer { position: absolute; z-index: 2; left: 13mm; right: 13mm; bottom: 7mm; display: grid; grid-template-columns: auto 1fr auto 1fr auto; align-items: center; gap: 2mm; color: #8a7a61; font: 700 6px/1 var(--font-print-display); }
.sheet-footer i { height: .5px; background: #baaa8d; }

@media (max-width: 760px) {
  .sheet-page { width: 210mm; min-width: 210mm; }
}

@media print {
  .sheet-page {
    width: 210mm;
    height: 297mm;
    min-height: 297mm;
    max-height: 297mm;
    margin: 0;
    padding: 12mm 13mm 14mm;
    box-shadow: none;
    break-after: page;
    page-break-after: always;
  }
  .sheet-page:last-child { break-after: auto; page-break-after: auto; }
}
</style>
