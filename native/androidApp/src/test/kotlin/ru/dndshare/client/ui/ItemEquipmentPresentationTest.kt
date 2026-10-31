package ru.dndshare.client.ui

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class ItemEquipmentPresentationTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    @Test
    fun catalogueDiceSupportSystemLabelsAndSuggestReferences() {
        val metadata = HandbookMetadata(suggests = mapOf("1" to listOf(Suggest(2, 1, "к6"))))
        assertEquals(6, catalogueDieSides(JsonPrimitive(2), metadata))
        assertEquals(8, catalogueDieSides(JsonPrimitive("d8"), metadata))
        assertNull(catalogueDieSides(JsonPrimitive(99), metadata))
    }

    @Test
    fun costDoesNotMistakeAnUnrelatedSuggestForCurrency() {
        val metadata =
            HandbookMetadata(
                suggests =
                    mapOf(
                        "9" to listOf(Suggest(1, 9, "Обычное")),
                        "17" to listOf(Suggest(1, 17, "Серебряные", code = "см")),
                    )
            )
        assertEquals("", catalogueCost(obj("{}"), metadata))
        assertEquals("", catalogueCost(obj("""{"suggest_id":1}"""), metadata))
        assertEquals("5 см", catalogueCost(obj("""{"value":5,"suggest_id":1}"""), metadata))
        assertEquals(
            "0 см · диапазон 0–10 см",
            catalogueCost(obj("""{"value":0,"min":0,"max":10,"suggest_id":1}"""), metadata),
        )
    }

    @Test
    fun magicPreviewUsesNumericRarityActivationAndOwnedChargeStock() {
        val item =
            CatalogueItem(
                19,
                19,
                "Копьё",
                data =
                    obj(
                        """{"type":"оружие","rarity":1,"attunement":"none","activation":"equipped","weapon":{"base_item_id":8},"initial_charges":{"mode":"roll","formula":"1к6"},"use_resources":[{"key":"light","title":"Свет","max_use":3}]}"""
                    ),
            )
        val instance =
            obj(
                """{"item_id":8,"magic_item_id":19,"params":{"magic":{"max_use":5,"remaining":0,"resource_counts":{"light":1}}}}"""
            )
        val summary = catalogueSummary(item, null, HandbookMetadata(), instance)
        assertEquals("Необычный", summary.left.last().value)
        assertEquals(listOf("0 / 5", "1 / 3"), summary.right.map { it.value })
        assertEquals(listOf("Без настройки", "При экипировке"), summary.rail.map { it.value })
        assertEquals(listOf("weapon" to 8L), selectedEquipmentBases(item, instance))
        assertEquals("1к6", catalogueSummary(item, null, HandbookMetadata()).right.first().value)
        assertTrue(selectedEquipmentBases(item, null).isEmpty())
        val lost = obj("""{"params":{"magic":{"lost":true}}}""")
        assertTrue(catalogueSummary(item, null, HandbookMetadata(), lost).right.isEmpty())
        assertEquals(
            "Состояние экземпляра",
            catalogueSummary(item, null, HandbookMetadata(), lost).rail.single().label,
        )
    }

    @Test
    fun specialUseKeepsLineAndSavingThrowRequirements() {
        val lines =
            equipmentUseRequirements(
                obj(
                    """{"requirements":["Один раз за ход"],"area":{"width_ft":5},"save":{"ability":2,"dc":13,"half":true}}"""
                ),
                120,
            )
        assertEquals(
            listOf(
                "Один раз за ход",
                "Линия до 120 × 5 футов",
                "Спасбросок: Ловкость · Сл 13 · половина урона при успехе",
            ),
            lines,
        )
    }

    @Test
    fun deletingOneInstanceAlsoRemovesOnlyItsWeaponStatuses() {
        val sheet =
            CharacterSheet(
                "DND5",
                1,
                obj(
                    """{"values":{"weapon":[{"uid":"a","item_id":1},{"uid":"b","item_id":1,"params":{"magic":{"remaining":2}}}],"states":[{"id":3,"params":{"weapon_uid":"a"}},{"id":4,"params":{"weapon_uid":"b"}},{"id":5}]}}"""
                ),
                1,
            )
        val next =
            sheet.copy(data = applySheetPatches(sheet.data, weaponRemovalPatches(sheet, "a")))
        assertEquals(
            sheet.values["weapon"].arrayValue()[1],
            next.values["weapon"].arrayValue().single(),
        )
        assertEquals(
            sheet.values["states"].arrayValue().drop(1),
            next.values["states"].arrayValue(),
        )
        assertFails { weaponRemovalPatches(next, "a") }
    }
}
