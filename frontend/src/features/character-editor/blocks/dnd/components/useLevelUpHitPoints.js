import { computed, ref } from 'vue'
import { abilityModifier } from '@/shared/lib/dnd'
import { avgHitDie } from '../lib/levelUp'
import { useDiceStore } from '@/stores/dice'

export function useLevelUpHitPoints({ hitDieFace, statScore }) {
  const dice = useDiceStore()
  const hpMode = ref('avg')
  const hpRoll = ref(null)
  const hpManual = ref(null)
  const conMod = computed(() => abilityModifier(statScore('CON')))
  const hpAvg = computed(() => avgHitDie(hitDieFace.value))
  function setHpMode(m) { hpMode.value = m; hpRoll.value = null }
  function rollHp() {
    const r = dice.roll('Кость хитов', `1d${hitDieFace.value}`)
    hpRoll.value = r?.total ?? null
  }
  const hpDie = computed(() => {
    if (hpMode.value === 'manual') return Math.max(1, Number(hpManual.value ?? hpAvg.value) || 1)
    if (hpMode.value === 'roll') return hpRoll.value ?? hpAvg.value
    return hpAvg.value
  })
  const hpGain = computed(() => Math.max(1, hpDie.value + (hpMode.value === 'manual' ? 0 : conMod.value)))
  const hpReady = computed(() => hpMode.value !== 'roll' || hpRoll.value != null)
  return { hpMode, hpRoll, hpManual, hpAvg, hpDie, hpGain, hpReady, conMod, setHpMode, rollHp }
}
