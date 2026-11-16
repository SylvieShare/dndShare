<template>
  <div class="red-stack">
    <BaseTile :outlined="false"
      ><div class="red-panel">
        <h2>NET-сцена · Интерфейс {{ rank }}</h2>
        <ActionButton
          :disabled="!rank"
          @click="
            emit('roll', {
              kind: 'interface',
              mode: 'scanner',
              title: 'Поиск точки доступа',
            })
          "
          >Сканер · мясное действие</ActionButton
        >
        <p v-if="error" class="red-danger" role="alert">{{ error }}</p>
        <FormField label="Кибердека" vertical
          ><FormSelect
            v-if="editable"
            :value="net.deckUid || ''"
            @update:value="set({ deckUid: $event })"
            ><option value="">Выберите деку</option>
            <option v-for="e in decks" :key="e.uid" :value="e.uid">
              {{ byKey[e.key]?.name }} · {{ byKey[e.key]?.facts.slots }} слотов
            </option></FormSelect
          ><span v-else>{{
            byKey[deck?.key]?.name || "Нет деки"
          }}</span></FormField
        >
        <div class="red-actions">
          <strong>{{ net.connected ? "Подключён" : "Отключён" }}</strong
          ><ActionButton
            v-if="editable"
            :disabled="!rank || !deck"
            @click="toggleConnection"
            >{{ net.connected ? "Отключиться" : "Подключиться" }}</ActionButton
          ><ActionButton v-if="editable && net.connected" @click="newTurn"
            >Новый ход · {{ totalActions }} NET-действия</ActionButton
          >
        </div>
        <strong v-if="net.connected"
          >Осталось действий: {{ net.actionsRemaining || 0 }}</strong
        >
        <div v-if="net.connected" class="red-actions">
          <ActionButton
            v-for="[key, name] in actions"
            :key="key"
            :disabled="!net.actionsRemaining"
            @click="emit('roll', { kind: 'interface', title: name, mode: key })"
            >{{ name }}</ActionButton
          >
        </div>
      </div></BaseTile
    >
    <BaseTile :outlined="false"
      ><div class="red-panel">
        <div class="red-row">
          <h2>Программы · {{ usedSlots }} / {{ capacity }}</h2>
          <ActionButton v-if="editable" @click="picker = true"
            >Загрузить</ActionButton
          >
        </div>
        <div v-for="p in net.loadedPrograms" :key="p.uid" class="red-list-item">
          <h3>{{ byKey[p.key]?.name || p.key }}</h3>
          <strong v-if="p.destroyed" class="red-danger">Уничтожена</strong
          ><small>{{ byKey[p.key]?.description }}</small
          ><small
            >{{ byKey[p.key]?.facts.programClass }} · ATK
            {{ byKey[p.key]?.facts.atk }} · DEF
            {{ byKey[p.key]?.facts.defense }}</small
          ><FormField label="REZ" vertical
            ><FormNumberInput
              v-if="editable"
              :value="p.rez"
              :min="0"
              :max="byKey[p.key]?.facts.rez || 0"
              @change="updateProgram(p, { rez: $event })"
            /><strong v-else>{{ p.rez }}</strong></FormField
          >
          <div class="red-actions">
            <ActionButton
              v-if="
                editable &&
                byKey[p.key]?.facts.programClass?.endsWith('attacker')
              "
              :disabled="
                !net.connected || !net.actionsRemaining || p.usedThisTurn
              "
              @click="
                emit('roll', {
                  kind: 'interface',
                  mode: 'program',
                  entryUid: p.uid,
                  targetType:
                    byKey[p.key]?.facts.programClass === 'antiprogramattacker'
                      ? 'blackIce'
                      : 'netrunner',
                  targetNodeUid:
                    byKey[p.key]?.facts.programClass === 'antiprogramattacker'
                      ? net.nodeUid
                      : undefined,
                  title: byKey[p.key]?.name,
                })
              "
              >Атаковать</ActionButton
            ><ActionButton
              v-else-if="editable"
              :disabled="
                !net.connected ||
                !net.actionsRemaining ||
                p.destroyed ||
                (!p.active && p.usedThisTurn)
              "
              @click="activate(p)"
              >{{ p.active ? "Деактивировать" : "Активировать" }}</ActionButton
            ><ActionButton
              v-if="editable && !net.connected"
              variant="quiet"
              @click="
                set({
                  loadedPrograms: net.loadedPrograms.filter(
                    (e) => e.uid !== p.uid,
                  ),
                })
              "
              >Выгрузить</ActionButton
            >
          </div>
        </div>
        <small
          >Между NET-сценами состояние программ восстанавливается при подготовке
          деки. Атакующая программа деактивируется после использования.</small
        >
      </div></BaseTile
    >
    <BaseTile :outlined="false"
      ><div class="red-panel">
        <h2>Обнаруженная архитектура</h2>
        <p>
          Записывайте только известные персонажу этажи. Секретные сведения
          ведущего должны оставаться в закрытых материалах сессии.
        </p>
        <FormTextarea
          v-if="editable"
          :value="net.discovered || ''"
          :rows="7"
          @update:value="set({ discovered: $event })"
        />
        <p v-else class="red-results">
          {{ net.discovered || "Архитектура не исследована" }}
        </p>
        <FormField label="Текущий этаж" vertical
          ><FormNumberInput
            v-if="editable"
            :value="net.floor || 1"
            :min="1"
            :max="100"
            @change="set({ floor: $event })"
          /><strong v-else>{{ net.floor || 1 }}</strong></FormField
        >
      </div></BaseTile
    >
    <RedArchitecture
      :items="items"
      :net="net"
      :editable="editable"
      @change="set"
      @roll="emit('roll', $event)"
    /><RedItemPicker
      v-if="picker"
      :items="ownedPrograms"
      :kinds="['program', 'blackIce']"
      title="Программы из инвентаря"
      @select="load"
      @close="picker = false"
    />
  </div>
</template>
<script setup>
import { computed, ref } from "vue";
import {
  BaseTile,
  ActionButton,
  FormField,
  FormSelect,
  FormNumberInput,
  FormTextarea,
} from "@sylvieshare/share-ui";
import RedItemPicker from "./RedItemPicker.vue";
import RedArchitecture from "./RedArchitecture.vue";
import { redNetActions } from "../../../settings/cyberpunk-red/gameplay";
const props = defineProps({ values: Object, items: Array, editable: Boolean });
const emit = defineEmits(["patch", "roll"]);
const error = ref(""),
  picker = ref(false),
  net = computed(() => props.values.netrunning),
  byKey = computed(() =>
    Object.fromEntries(props.items.map((i) => [i.key, i])),
  );
const rank = computed(
    () => props.values.roles.find((r) => r.key === "netrunner")?.rank || 0,
  ),
  totalActions = computed(() => redNetActions(rank.value));
const decks = computed(() =>
  props.values.inventory.entries.filter(
    (e) => byKey.value[e.key]?.kind === "cyberdeck",
  ),
);
const deck = computed(() =>
    decks.value.find((e) => e.uid === net.value.deckUid),
  ),
  capacity = computed(() => byKey.value[deck.value?.key]?.facts.slots || 0);
const usedSlots = computed(() =>
  net.value.loadedPrograms.reduce(
    (n, p) => n + (byKey.value[p.key]?.facts.size || 1),
    0,
  ),
);
const ownedPrograms = computed(() =>
  props.items.filter(
    (i) =>
      ["program", "blackIce"].includes(i.kind) &&
      props.values.inventory.entries.some(
        (e) =>
          e.key === i.key &&
          e.count >
            net.value.loadedPrograms.filter((p) => p.entryUid === e.uid).length,
      ),
  ),
);
const actions = [
  ["backdoor", "Бэкдор"],
  ["cloak", "Плащ"],
  ["control", "Контроль"],
  ["eyedee", "Расшифровка"],
  ["pathfinder", "Первопроходец"],
  ["slide", "Соскользнуть"],
  ["virus", "Вирус"],
  ["zap", "Разряд"],
];
function set(patch) {
  emit("patch", { netrunning: { ...net.value, ...patch } });
}
function toggleConnection() {
  error.value = "";
  if (net.value.connected && net.value.immobilizedTurns > 0) {
    error.value = "Безопасное отключение заблокировано эффектом NET-атаки";
    return;
  }
  if (net.value.connected && !(net.value.actionsRemaining > 0)) {
    error.value = "Для безопасного отключения нужно NET-действие";
    return;
  }
  if (
    !net.value.connected &&
    !props.values.cyberware.installations.some(
      (e) => e.key === "cyberware-interface-plugs",
    )
  ) {
    error.value = "Нужны интерфейсные разъёмы";
    return;
  }
  set({
    connected: !net.value.connected,
    actionsRemaining: net.value.connected ? 0 : totalActions.value - 1,
    loadedPrograms: net.value.loadedPrograms.map((p) => ({
      ...p,
      active: false,
      usedThisRun: false,
      usedThisTurn: false,
      rez: p.destroyed ? 0 : byKey.value[p.key]?.facts.rez || 0,
    })),
  });
}
function updateProgram(p, patch) {
  set({
    loadedPrograms: net.value.loadedPrograms.map((e) =>
      e.uid === p.uid ? { ...e, ...patch } : e,
    ),
  });
}
function load(item) {
  if (net.value.connected) {
    error.value = "Меняйте загруженные программы вне NET-сцены";
    return;
  }
  if (usedSlots.value + (item.facts.size || 1) > capacity.value) {
    error.value = "Нет свободных слотов";
    return;
  }
  const entry = props.values.inventory.entries.find(
    (e) =>
      e.key === item.key &&
      e.count >
        net.value.loadedPrograms.filter((p) => p.entryUid === e.uid).length,
  );
  if (!entry) return;
  set({
    loadedPrograms: [
      ...net.value.loadedPrograms,
      {
        uid: crypto.randomUUID(),
        entryUid: entry.uid,
        key: item.key,
        active: false,
        rez: item.facts.rez,
      },
    ],
  });
  picker.value = false;
}
function activate(p) {
  error.value = "";
  if (
    !p.active &&
    byKey.value[p.key]?.facts.programClass === "defender" &&
    p.usedThisRun
  ) {
    error.value = "Эта защитная программа уже использована в NET-сцене";
    return;
  }
  if (
    !p.active &&
    byKey.value[p.key]?.facts.programClass === "defender" &&
    net.value.loadedPrograms.some((e) => e.key === p.key && e.active)
  ) {
    error.value = "Одновременно активна только одна копия программы";
    return;
  }
  set({
    actionsRemaining: net.value.actionsRemaining - 1,
    loadedPrograms: net.value.loadedPrograms.map((e) =>
      e.uid === p.uid
        ? {
            ...e,
            active: !e.active,
            usedThisTurn: e.usedThisTurn || !e.active,
            usedThisRun: e.usedThisRun || !e.active,
            rez: !e.active ? byKey.value[e.key]?.facts.rez || 0 : e.rez,
          }
        : e,
    ),
  });
}
function newTurn() {
  set({
    actionsRemaining: Math.max(
      2,
      totalActions.value - (net.value.nextActionPenalty || 0),
    ),
    nextActionPenalty: 0,
    immobilizedTurns: Math.max(0, (net.value.immobilizedTurns || 0) - 1),
    nodes: (net.value.nodes || []).map((n) => ({
      ...n,
      attackedThisTurn: false,
    })),
    slideUsed: false,
    loadedPrograms: net.value.loadedPrograms.map((p) => ({
      ...p,
      usedThisTurn: false,
    })),
  });
}
</script>
