package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*

class MoneyCalculationTest {
    @Test
    fun calculatorMatchesArithmeticRoundingAndKeepsLargeIntegerBalances() {
        val input = buildJsonObject { put("1", 4_000_000_000L) }
        assertEquals(4_000_000_014L, moneyCalculation(input, "1", "2+3*4", 1))
        assertEquals(3_999_999_980L, moneyCalculation(input, "1", "(2+3)*4", -1))
        assertEquals(MAX_WALLET_AMOUNT, arithmeticLongAmount(MAX_WALLET_AMOUNT.toString()))
        assertEquals(1L, arithmeticLongAmount("-1.5"))
    }

    @Test
    fun invalidExpressionsOverspendingAndUnsafeBalancesNeverChangeMoney() {
        val input = buildJsonObject { put("1", 2) }
        assertFails { moneyCalculation(input, "1", "3", -1) }
        assertFails { moneyCalculation(input, "1", "1/0", 1) }
        assertFails { moneyCalculation(input, "1", "alert(1)", 1) }
        assertFails {
            moneyCalculation(buildJsonObject { put("1", MAX_WALLET_AMOUNT) }, "1", "1", 1)
        }
        assertEquals(JsonPrimitive(2), input["1"])
    }
}
