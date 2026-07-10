<template>
  <div class="step">
    <div class="sheet-section-title">Личность <span class="opt">— необязательно</span></div>
    <p class="hint">Опиши характер персонажа. Всё это можно заполнить и позже — на вкладке «Личность» листа.</p>

    <label class="fld">
      <span class="lbl">Мировоззрение</span>
      <select v-model="p.alignment" class="inp">
        <option value="">—</option>
        <option v-for="a in ALIGNMENTS" :key="a" :value="a">{{ a }}</option>
      </select>
    </label>

    <div class="two">
      <label class="fld"><span class="lbl">Черты характера</span><textarea v-model="p.traits" class="inp ta" rows="2" placeholder="Как ведёт себя персонаж" /></label>
      <label class="fld"><span class="lbl">Идеалы</span><textarea v-model="p.ideals" class="inp ta" rows="2" placeholder="Во что верит" /></label>
      <label class="fld"><span class="lbl">Привязанности</span><textarea v-model="p.bonds" class="inp ta" rows="2" placeholder="Что дорого" /></label>
      <label class="fld"><span class="lbl">Слабости</span><textarea v-model="p.flaws" class="inp ta" rows="2" placeholder="Пороки и уязвимости" /></label>
    </div>

    <label class="fld"><span class="lbl">Внешность</span><textarea v-model="p.appearance" class="inp ta" rows="2" placeholder="Как выглядит персонаж" /></label>

    <div class="phys">
      <label class="fld sm"><span class="lbl">Возраст</span><input v-model="p.age" class="inp" type="text" /></label>
      <label class="fld sm"><span class="lbl">Рост</span><input v-model="p.height" class="inp" type="text" /></label>
      <label class="fld sm"><span class="lbl">Вес</span><input v-model="p.weight" class="inp" type="text" /></label>
      <label class="fld sm"><span class="lbl">Глаза</span><input v-model="p.eyes" class="inp" type="text" /></label>
      <label class="fld sm"><span class="lbl">Волосы</span><input v-model="p.hair" class="inp" type="text" /></label>
      <label class="fld sm"><span class="lbl">Кожа</span><input v-model="p.skin" class="inp" type="text" /></label>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const { state } = inject('createWizard')
const p = state.persona

const ALIGNMENTS = [
  'Законно-добрый', 'Нейтрально-добрый', 'Хаотично-добрый',
  'Законно-нейтральный', 'Нейтральный', 'Хаотично-нейтральный',
  'Законно-злой', 'Нейтрально-злой', 'Хаотично-злой',
]
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 12px; }
.opt { font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--text-muted); }
.hint { font-size: 12px; color: var(--text-muted); margin: 0; }
.two { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.phys { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
.fld { display: flex; flex-direction: column; gap: 5px; }
.lbl { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-muted); font-weight: 650; }
.inp {
  background: var(--bg); border: 1px solid var(--input-border); border-radius: 8px;
  color: var(--text-1); font: inherit; font-size: 13px; padding: 8px 10px; outline: none; box-sizing: border-box; width: 100%;
}
.inp:focus { border-color: var(--input-focus); }
.ta { resize: vertical; line-height: 1.4; }
</style>
