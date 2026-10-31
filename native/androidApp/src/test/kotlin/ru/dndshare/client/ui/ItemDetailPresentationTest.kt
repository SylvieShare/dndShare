package ru.dndshare.client.ui

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.model.*

class ItemDetailPresentationTest {
    @Test
    fun weaponCoverSeparatesDamageEconomyAndProficiency() {
        val metadata =
            HandbookMetadata(
                suggests =
                    mapOf(
                        "1" to listOf(Suggest(2, 1, "к6")),
                        "12" to listOf(Suggest(10, 12, "Колющий")),
                        "14" to listOf(Suggest(20, 14, "Метательное")),
                        "4" to listOf(Suggest(30, 4, "Простое оружие")),
                    )
            )
        val item =
            CatalogueItem(
                1,
                1,
                "Копьё",
                data =
                    WireJson.parseToJsonElement(
                            """{"attacks":[{"count":1,"dice_id":2,"type":10}],"range_min":20,"range_max":60,"weight":3,"tags":[20],"required_weapon_proficiencies":[30]}"""
                        )
                        .jsonObject,
            )
        val summary = catalogueSummary(item, null, metadata)
        assertEquals("1к6", summary.left.first().value)
        assertEquals("Колющий", summary.left.first().note)
        assertEquals("20/60 фт.", summary.right.first().value)
        assertEquals("Простое оружие", summary.rail.first().value)
        assertEquals("Метательное", summary.rail.last().value)
        assertTrue("attacks" in summary.keys)
        assertFalse("notes" in summary.keys)
    }

    @Test
    fun coverHeightHonoursTheWebMinimumAndImageAspect() {
        assertEquals(420f, catalogueCoverHeight(1, 390f, null))
        assertEquals(540f, catalogueCoverHeight(1, 720f, null))
        assertEquals(300f, catalogueCoverHeight(5, 720f, null))
        assertEquals(720f, catalogueCoverHeight(1, 720f, 1f))
    }

    @Test
    fun spellMaterialsAndReactionConditionsStayAvailable() {
        val item =
            CatalogueItem(
                7,
                5,
                "Щит",
                data =
                    buildJsonObject {
                        put("lvl", 1)
                        put(
                            "time",
                            buildJsonObject {
                                put("kind", "reaction")
                                put("condition", "При попадании")
                            },
                        )
                        put(
                            "components",
                            buildJsonObject {
                                put("v", true)
                                put("m", "Медная проволока")
                            },
                        )
                    },
            )
        val summary = catalogueSummary(item, ItemType(5, "Заклинания"), HandbookMetadata())
        val values = summary.left + summary.right
        assertEquals("В · М", values.first { it.label == "Компоненты" }.value)
        assertEquals("При попадании", values.first { it.label == "Время" }.note)
        assertFalse("components" in summary.keys)
    }

    @Test
    fun localizedAttunementLabelDoesNotChangeItsRule() {
        val type =
            ItemType(
                19,
                "Магические предметы",
                fields =
                    WireJson.parseToJsonElement(
                        """[{"key":"attunement","name":"Настройка","type":"select","options":[{"value":"none","label":"Не требуется"},{"value":"required","label":"Требуется"}]}]"""
                    ),
            )
        fun summary(value: String) =
            catalogueSummary(
                CatalogueItem(9, 19, "Копьё", data = buildJsonObject { put("attunement", value) }),
                type,
                HandbookMetadata(),
            )
        assertEquals("Без настройки", summary("none").rail.first().value)
        assertEquals("Требует настройки", summary("required").rail.first().value)
    }
}
