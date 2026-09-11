import { computed, reactive, unref } from 'vue'
import { hasInitialChargeStock, initialChargeStocks, initialChargeDefault, initialChargeRuleError, initializeItemCharges, validChargeCount } from '@/shared/lib/itemInitialCharges'

export function useInitialChargeStocks(item, params) {
  const counts = reactive({})
  const stocks = computed(() => initialChargeStocks(unref(item)?.data))
  const pending = computed(() => stocks.value.filter(row => !hasInitialChargeStock(unref(params), row.key)))
  const count = row => counts[row.key] ?? initialChargeDefault(row.rule)
  const complete = computed(() => pending.value.every(row => validChargeCount(count(row)) && !initialChargeRuleError(row.rule)))
  function result(base = unref(params) || {}) {
    return pending.value.reduce((next, row) => initializeItemCharges(next, count(row), row.key), base)
  }
  return { stocks, pending, counts, count, complete, result }
}
