package ru.dndshare.client

import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.character.*

class ArithmeticTest {
    @Test
    fun calculatorsUseBoundedArithmeticAndRoundLikeTheWeb() {
        assertEquals(14, arithmeticAmount("2+3*4"))
        assertEquals(20, arithmeticAmount("(2+3)*4"))
        assertEquals(1, arithmeticAmount("-1.5"))
        assertEquals(3, arithmeticAmount("10/4"))
        assertEquals(0, arithmeticAmount(""))
        for (text in
            listOf("1/0", "Infinity", "2+window.alert(1)", "999999999999", "1+")) assertFails {
            arithmeticAmount(text)
        }
    }

    @Test
    fun oppositeRollModesCancelAndAnExplicitModeWins() {
        assertEquals("normal", automaticRollMode("auto", listOf("advantage", "disadvantage")))
        assertEquals("advantage", automaticRollMode("auto", listOf("advantage", "advantage")))
        assertEquals("disadvantage", automaticRollMode("disadvantage", listOf("advantage")))
    }
}
