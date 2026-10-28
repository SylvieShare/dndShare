package ru.dndshare.client.ui.character

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class StatFormTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    @Test
    fun statDraftKeepsUnknownFieldsAndPersistsAllControls() {
        val sheet =
            CharacterSheet(
                "DND5",
                1,
                obj(
                    """{"values":{"STR":{"value":{"base":12,"bonuses":[{"title":"Дар","value":1}]},"unknown":"keep","skills":{"1":{"up":1,"custom":"keep"}}}}}"""
                ),
                1,
            )
        val initial = initialForm("STR", sheet)
        val input =
            JsonObject(
                initial.input +
                    obj(
                        """{"save_up":true,"save_bonuses":[{"value":"2"}],"check_roll_mode":"advantage","skills":{"1":{"up":"2","custom":"keep","bonuses":[{"value":"3"}]},"custom":{"override_title":"Плавание","up":0}}}"""
                    )
            )
        val form = initial.copy(number = "16", input = input)
        val changed =
            sheet.copy(data = applySheetPatches(sheet.data, formPatches(form, sheet, emptyMap())))
        val stat = changed.values["STR"].objectValue()
        assertEquals("keep", stat.text("unknown"))
        assertEquals(
            17,
            stat["value"].objectValue()["base"].number() +
                stat["value"].objectValue()["bonuses"].bonusTotal(),
        )
        assertEquals(JsonPrimitive(true), stat["save_up"])
        assertEquals(2, stat["save_bonuses"].bonusTotal())
        assertEquals("advantage", stat.text("check_roll_mode"))
        assertEquals(2, stat["skills"].objectValue()["1"].objectValue()["up"].number())
        assertFails { formPatches(form.copy(number = "-1"), sheet, emptyMap()) }
    }

    @Test
    fun editingAbilityKeepsSourceIdentityAndRemovingOwnerRemovesOnlyItsSpells() {
        val sheet =
            CharacterSheet(
                "DND5",
                1,
                obj(
                    """{"values":{"abilities_story":[{"id":4,"count":1}],"spells":{"grants":[{"id":9,"key":"old","source":{"kind":"ability","item_id":4}},{"id":8,"key":"class","source":{"kind":"class","item_id":2}}]}}}"""
                ),
                1,
            )
        assertNull(featureEntryInput("ability:abilities_story:0", sheet.values)["uid"])
        val ability =
            CatalogueItem(
                4,
                18,
                "Дар",
                data = obj("""{"level":1,"granted_spells":[{"spell":9}]}"""),
            )
        assertEquals(
            2,
            syncAbilitySpellGrants(
                    sheet,
                    emptyMap(),
                    sheet.values["spells"].objectValue()["grants"].arrayValue(),
                )
                .size,
        )
        val removed =
            sheet.copy(
                data =
                    applySheetPatches(
                        sheet.data,
                        listOf(
                            SheetPatch(
                                path = sheetPath("values", "abilities_story"),
                                value = JsonArray(emptyList()),
                            )
                        ),
                    )
            )
        val grants =
            syncAbilitySpellGrants(
                removed,
                mapOf(4L to ability),
                sheet.values["spells"].objectValue()["grants"].arrayValue(),
            )
        assertEquals("class", grants.single().objectValue().text("key"))
    }
}
