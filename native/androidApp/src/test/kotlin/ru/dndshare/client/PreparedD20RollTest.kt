package ru.dndshare.client

import kotlin.random.Random
import kotlin.test.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class PreparedD20RollTest {
    private fun obj(value: String) = WireJson.parseToJsonElement(value).jsonObject

    private val minimumRandom =
        object : Random() {
            override fun nextBits(bitCount: Int) = 0
        }
    private val sheet =
        CharacterSheet(
            "DND5",
            1,
            obj("""{"values":{"lvl":{"level":5},"abilities_class":[{"id":10}]}}"""),
            1,
        )
    private val feature =
        CatalogueItem(
            10,
            4,
            "Талант",
            data =
                obj(
                    """{"derived_effects":[{"kind":"roll_mode","mode":"advantage"},{"kind":"roll_bonus","formula":"1d4"}],"roll_adjustments":[{"kind":"minimum_natural","value":10,"scope":"ability_check","minimum_proficiency_rank":1}]}"""
                ),
        )
    private val request =
        SheetRollRequest("Проверка", "ability_check", bonus = 3, proficiencyRank = 1)

    @Test
    fun frozenBonusAndRulesSurviveReloadAndTheSourceEnding() {
        val derived = DndDerivedValues(sheet, mapOf(10L to feature), HandbookMetadata())
        val plan = prepareD20Roll(request, derived, random = minimumRandom)
        val restored = WireJson.decodeFromString<PreparedD20Roll>(WireJson.encodeToString(plan))
        val result = resolvePreparedD20(restored, listOf(1, 7))
        assertEquals("advantage", result.mode)
        assertEquals(7, result.selected)
        assertEquals(listOf(1), result.bonusDice)
        assertEquals(14, result.total) // minimum 10 + frozen d4=1 + flat 3
        assertEquals(JsonPrimitive(10), result.adjustments.single()["value"])
        assertEquals("2d20+3+1d4", result.expression)
        assertEquals(result, resolvePreparedD20(restored, listOf(1, 7)))
        val ended =
            sheet.copy(data = obj("""{"values":{"lvl":{"level":5},"abilities_class":[]}}"""))
        val fresh =
            prepareD20Roll(
                request,
                DndDerivedValues(ended, emptyMap(), HandbookMetadata()),
                random = minimumRandom,
            )
        assertEquals("normal", fresh.mode)
        assertTrue(fresh.bonusDice.isEmpty())
        assertEquals(23, resolvePreparedD20(restored, listOf(19, 3)).total)
        assertTrue(resolvePreparedD20(restored, listOf(19, 3)).adjustments.isEmpty())
    }

    @Test
    fun invalidServerResultsCannotProduceACompletedRoll() {
        val plan =
            prepareD20Roll(
                request,
                DndDerivedValues(sheet, mapOf(10L to feature), HandbookMetadata()),
                random = minimumRandom,
            )
        for (rolls in
            listOf(emptyList(), listOf(10), listOf(0, 10), listOf(21, 10), listOf(1, 2, 3))) {
            assertFailsWith<IllegalArgumentException> { resolvePreparedD20(plan, rolls) }
        }
    }
}
