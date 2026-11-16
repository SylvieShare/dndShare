<template>
  <BaseTile :outlined="false"
    ><div class="red-panel">
      <h2>Известная архитектура</h2>
      <p class="red-muted">
        Только обнаруженные узлы. Параметры Демонов вводит ведущий по своей
        книге. Переходы идут по связям; неоткрытый пароль блокирует движение
        дальше.
      </p>
      <p v-if="error" class="red-danger" role="alert">{{ error }}</p>
      <article v-for="node in nodes" :key="node.uid" class="red-list-item">
        <div class="red-row">
          <div>
            <h3>{{ node.name || types[node.type] }}</h3>
            <small
              >{{ types[node.type] }} ·
              {{
                node.uid === net.nodeUid
                  ? "Текущий узел"
                  : node.parentUid
                    ? "Связан с " +
                      (nodes.find((n) => n.uid === node.parentUid)?.name ||
                        "узлом")
                    : "Вход"
              }}</small
            >
          </div>
          <ActionButton v-if="editable" @click="move(node)"
            >Перейти</ActionButton
          >
        </div>
        <template v-if="['password', 'file', 'control'].includes(node.type)"
          ><p>
            DV {{ node.dv }} ·
            {{
              node.unlocked
                ? "открыт"
                : node.identified
                  ? "опознан"
                  : node.controlled
                    ? "под контролем"
                    : "не пройден"
            }}
          </p>
          <ActionButton
            :disabled="!net.connected || !net.actionsRemaining"
            @click="rollNode(node)"
            >{{
              node.type === "password"
                ? "Взломать"
                : node.type === "file"
                  ? "Опознать"
                  : "Захватить контроль"
            }}</ActionButton
          ></template
        >
        <template v-if="['blackIce', 'demon', 'program'].includes(node.type)"
          ><div class="red-actions">
            <span
              >PER {{ node.perception }} · SPD {{ node.speed }} · ATK
              {{ node.attack }} · DEF {{ node.defense }}</span
            ><strong>REZ {{ node.rez }}</strong>
          </div>
          <div class="red-actions">
            <ActionButton
              v-if="node.type === 'blackIce'"
              :disabled="!net.connected"
              @click="
                emit('roll', {
                  kind: 'interface',
                  mode: 'speed',
                  targetNodeUid: node.uid,
                  title: 'Встреча: ' + node.name,
                })
              "
              >Первое столкновение</ActionButton
            ><ActionButton
              :disabled="!net.connected || !net.actionsRemaining"
              @click="
                emit('roll', {
                  kind: 'interface',
                  mode: 'zap',
                  targetNodeUid: node.uid,
                  targetType: 'blackIce',
                  title: 'Разряд: ' + node.name,
                })
              "
              >Разряд</ActionButton
            ><ActionButton
              :disabled="
                !net.connected ||
                !net.actionsRemaining ||
                net.slideUsed ||
                node.type === 'demon'
              "
              @click="
                emit('roll', {
                  kind: 'interface',
                  mode: 'slide',
                  targetNodeUid: node.uid,
                  title: 'Ускользнуть: ' + node.name,
                })
              "
              >Ускользнуть</ActionButton
            >
          </div>
          <ActionButton
            v-if="editable && node.key && node.type === 'blackIce'"
            :disabled="!net.connected || node.attackedThisTurn || !node.rez"
            @click="
              emit('roll', {
                kind: 'net-threat',
                targetNodeUid: node.uid,
                title: 'Атака ЛЬДА: ' + node.name,
              })
            "
            >Ход Чёрного ЛЬДА</ActionButton
          ><FormField v-if="editable" label="Текущий REZ" vertical
            ><FormNumberInput
              :value="node.rez"
              :min="0"
              :max="1000"
              @change="update(node, { rez: $event })" /></FormField
        ></template>
        <ActionButton v-if="editable" variant="quiet" @click="remove(node)"
          >Удалить узел</ActionButton
        >
      </article>
      <div v-if="editable" class="red-section">
        <h3>Добавить обнаруженный узел</h3>
        <FormField label="ЛЁД / Демон из справочника" vertical
          ><FormSelect :value="preset" @update:value="choosePreset($event)"
            ><option value="">Свой узел</option>
            <option
              v-for="item in (items || []).filter((i) =>
                ['blackIce', 'demon'].includes(i.kind),
              )"
              :key="item.key"
              :value="item.key"
            >
              {{ item.name }}
            </option></FormSelect
          ></FormField
        ><FormField label="Название" vertical
          ><FormTextInput v-model:value="name" /></FormField
        ><FormField label="Тип" vertical
          ><FormSelect v-model:value="type"
            ><option v-for="(label, key) in types" :key="key" :value="key">
              {{ label }}
            </option></FormSelect
          ></FormField
        ><FormField label="Связь с существующим узлом" vertical
          ><FormSelect v-model:value="parent"
            ><option value="">Вход</option>
            <option v-for="n in nodes" :key="n.uid" :value="n.uid">
              {{ n.name || types[n.type] }}
            </option></FormSelect
          ></FormField
        >
        <div class="red-form-grid">
          <FormField
            v-if="['password', 'file', 'control'].includes(type)"
            label="DV"
            vertical
            ><FormNumberInput
              :value="dv"
              :min="0"
              :max="30"
              @change="dv = $event" /></FormField
          ><template v-else
            ><FormField
              v-for="[key, label] in iceFields"
              :key="key"
              :label="label"
              vertical
              ><FormNumberInput
                :value="ice[key]"
                :min="0"
                :max="100"
                @change="ice[key] = $event" /></FormField
          ></template>
        </div>
        <ActionButton @click="add">Добавить узел</ActionButton>
      </div>
      <div v-if="editable" class="red-section">
        <h3>Вирус</h3>
        <FormTextarea
          :value="net.virus?.description || ''"
          placeholder="Эффект, согласованный с ведущим"
          @update:value="setVirus({ description: $event })"
        />
        <div class="red-two">
          <FormField label="Необходимо NET-действий" vertical
            ><FormNumberInput
              :value="net.virus?.required || 1"
              :min="1"
              :max="1000"
              @change="setVirus({ required: $event, spent: 0 })" /></FormField
          ><FormField label="DV ведущего" vertical
            ><FormNumberInput
              :value="net.virus?.dv || 10"
              :min="1"
              :max="30"
              @change="setVirus({ dv: $event })"
          /></FormField>
        </div>
        <p>
          Подготовлено {{ net.virus?.spent || 0 }} /
          {{ net.virus?.required || 1 }}
        </p>
        <ActionButton
          :disabled="!net.connected || !net.actionsRemaining"
          @click="prepareVirus"
          >Вложить доступные действия</ActionButton
        ><ActionButton
          :disabled="
            !net.connected ||
            (net.virus?.spent || 0) < (net.virus?.required || 1)
          "
          @click="
            emit('roll', {
              kind: 'interface',
              mode: 'virus',
              dv: net.virus.dv || 10,
              title: 'Размещение вируса',
            })
          "
          >Разместить вирус</ActionButton
        >
      </div>
    </div></BaseTile
  >
</template>
<script setup>
import { computed, reactive, ref } from "vue";
import {
  BaseTile,
  ActionButton,
  FormField,
  FormTextInput,
  FormSelect,
  FormNumberInput,
  FormTextarea,
} from "@sylvieshare/share-ui";
const props = defineProps({ net: Object, items: Array, editable: Boolean });
const emit = defineEmits(["change", "roll"]);
const nodes = computed(() => props.net.nodes || []),
  name = ref(""),
  type = ref("password"),
  parent = ref(""),
  dv = ref(8),
  error = ref("");
const preset = ref("");
function choosePreset(key) {
  preset.value = key;
  const item = props.items.find((i) => i.key === key);
  if (!item) return;
  type.value = item.kind;
  name.value = item.name;
  Object.assign(ice, {
    perception: item.facts.perception || 0,
    speed: item.facts.speed || 0,
    attack: item.facts.atk || 0,
    defense: item.facts.defense || item.facts.interface || 0,
    rez: item.facts.rez,
    interface: item.facts.interface || 0,
  });
}
const ice = reactive({
  perception: 0,
  speed: 0,
  attack: 0,
  defense: 0,
  rez: 0,
});
const iceFields = computed(() =>
  type.value === "demon"
    ? [
        ["interface", "Интерфейс"],
        ["rez", "REZ"],
        ["netActions", "NET-действия"],
        ["combatNumber", "Боевое число"],
      ]
    : [
        ["perception", "PER"],
        ["speed", "SPD"],
        ["attack", "ATK"],
        ["defense", "DEF"],
        ["rez", "REZ"],
      ],
);
const types = {
  password: "Пароль",
  file: "Файл",
  control: "Управляющий узел",
  blackIce: "Чёрный ЛЁД",
  demon: "Демон",
  program: "Программа",
};
function add() {
  const node = {
    uid: crypto.randomUUID(),
    key: preset.value || null,
    name: name.value.trim() || types[type.value],
    type: type.value,
    parentUid: parent.value || null,
    dv: dv.value,
    ...ice,
  };
  emit("change", {
    nodes: [...nodes.value, node],
    nodeUid: props.net.nodeUid || node.uid,
  });
  name.value = "";
}
function update(node, patch) {
  emit("change", {
    nodes: nodes.value.map((n) =>
      n.uid === node.uid ? { ...n, ...patch } : n,
    ),
  });
}
function remove(node) {
  if (nodes.value.some((n) => n.parentUid === node.uid)) {
    error.value = "Сначала удалите дочерние узлы";
    return;
  }
  emit("change", {
    nodes: nodes.value.filter((n) => n.uid !== node.uid),
    nodeUid:
      props.net.nodeUid === node.uid ? node.parentUid : props.net.nodeUid,
  });
}
function move(node) {
  error.value = "";
  if (props.net.immobilizedTurns > 0) {
    error.value = "Движение блокировано эффектом NET-атаки";
    return;
  }
  const current = nodes.value.find((n) => n.uid === props.net.nodeUid);
  if (
    current &&
    node.uid !== current.parentUid &&
    node.parentUid !== current.uid
  ) {
    error.value = "Можно перейти только в связанный узел";
    return;
  }
  if (
    current?.type === "password" &&
    !current.unlocked &&
    node.parentUid === current.uid
  ) {
    error.value = "Сначала откройте пароль";
    return;
  }
  emit("change", { nodeUid: node.uid });
}
function rollNode(node) {
  emit("roll", {
    kind: "interface",
    mode: { password: "backdoor", file: "eyedee", control: "control" }[
      node.type
    ],
    targetNodeUid: node.uid,
    dv: node.dv,
    title: node.name || types[node.type],
  });
}
function setVirus(patch) {
  emit("change", {
    virus: { required: 1, spent: 0, dv: 10, ...props.net.virus, ...patch },
  });
}
function prepareVirus() {
  const current = nodes.value.find((n) => n.uid === props.net.nodeUid);
  if (!current || nodes.value.some((n) => n.parentUid === current.uid)) {
    error.value = "Вирус размещается в нижнем узле архитектуры";
    return;
  }
  const p = props.net.virus || { required: 1, spent: 0, dv: 10 };
  const spent = Math.min(
    props.net.actionsRemaining,
    Math.max(0, p.required - p.spent),
  );
  emit("change", {
    actionsRemaining: props.net.actionsRemaining - spent,
    virus: { ...p, spent: p.spent + spent },
  });
}
</script>
