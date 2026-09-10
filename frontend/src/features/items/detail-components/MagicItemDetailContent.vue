<template>
  <div class="magic-item-detail">
    <DetailSection label="Магические свойства">
      <p>{{ rarity }} · {{ data.type || 'Магический предмет' }}</p>
      <p>{{ attunement }}<template v-if="data.attunement_requirement">: {{ data.attunement_requirement }}</template></p>
      <p>{{ data.activation === 'carried' ? 'Свойства действуют, пока предмет находится в инвентаре.' : 'Свойства действуют, когда предмет экипирован или находится в руках.' }}</p>
    </DetailSection>
    <ItemDetailContent :item="item" :show-title="false" :economy-in-header="economyInHeader" />
    <DetailSection v-if="data.weapon" label="Оружие на листе">
      <p>Экипированный предмет добавляет атаку в блок оружия. Настройка и заряды остаются у того же экземпляра в инвентаре.</p>
      <p v-if="!data.weapon.base_item_id">Выберите оружейную основу в «Магических свойствах» экземпляра.</p>
      <p v-if="data.weapon.magic_bonus">Бонус к атаке и урону: +{{ data.weapon.magic_bonus }}<template v-if="data.attunement === 'required' && !data.weapon.bonus_without_attunement"> после настройки</template>.</p>
    </DetailSection>
    <DetailSection v-if="data.max_use || data.use_resources?.length || data.recharge_note" label="Заряды и восстановление">
      <p v-if="data.max_use">Максимум зарядов: {{ data.max_use }}</p>
      <p v-for="resource in data.use_resources || []" :key="resource.key">{{ resource.title }}<template v-if="resource.max_use != null">: {{ resource.max_use }}</template></p>
      <p v-if="data.rollback_short_rest">Восстанавливаются после короткого отдыха</p>
      <p v-if="data.rollback_long_rest">Восстанавливаются после продолжительного отдыха</p>
      <p v-if="data.recharge_note">{{ data.recharge_note }}</p>
    </DetailSection>
    <DetailSection v-if="rules.length" label="На листе персонажа">
      <div v-for="(rule, index) in rules" :key="index"><strong>{{ rule.title }}</strong> {{ rule.value }}<p v-if="rule.note">{{ rule.note }}</p></div>
    </DetailSection>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import DetailSection from '@/shared/ui/DetailSection.vue'
import ItemDetailContent from './ItemDetailContent.vue'
import { statusRulePresentation } from '@/features/items/lib/statusEffectPresentation'
import { magicItemRarity, magicAttunementLabel } from '@/features/items/lib/magicItemPresentation'
const props = defineProps({ item: Object, economyInHeader: Boolean })
const data = computed(() => props.item.data || {})
const rarity = computed(() => magicItemRarity(data.value.rarity))
const attunement = computed(() => magicAttunementLabel(data.value.attunement))
const rules = computed(() => [
  ...(data.value.derived_effects || []).map(statusRulePresentation),
  ...(data.value.feature_actions || []).map(row => ({ title: row.title || 'Действие', value: row.uses_resource ? `Расход: ${row.resource_cost || 1}` : '' })),
  ...(data.value.passive_effects || []).map(row => ({ title: row.title, value: row.description })),
])
</script>
<style scoped>
.magic-item-detail { display: flex; flex-direction: column; gap: 14px; }
.magic-item-detail p { margin: 4px 0; }
</style>
