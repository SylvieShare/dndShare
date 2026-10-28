package ru.dndshare.client

import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlin.test.*
import org.junit.Test
import org.junit.runner.RunWith
import ru.dndshare.client.character.*

@RunWith(AndroidJUnit4::class)
class DiceRuntimeTest {
    @Test
    fun typedDiceAndRichFormulasUseAndroidsActualRegexRuntime() {
        val result = rollDice("2d6{Огонь|#ef4444}+3{Огонь|#ef4444}+1d4{Холод}") { 2 }
        assertEquals(9, result.total)
        assertEquals(2, result.byType.size)
        assertEquals(
            8.0,
            richFormula(
                    "floor(char_level/2)+max(1, casting_mod)",
                    mapOf("char_level" to 9.0, "casting_mod" to 4.0),
                )
                .value,
        )
        assertFails { rollDice("1d6{Огонь") }
    }
}
