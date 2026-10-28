package ru.dndshare.client.ui.character

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class InventoryCustomFieldsTest {
    private fun obj(value: String) = WireJson.parseToJsonElement(value).jsonObject

    private fun sheet(entry: String) =
        CharacterSheet(
            "DND5",
            1,
            obj(
                """{"values":{"items":{"equipped":[],"sections":[{"id":"bag","items":[$entry],"slots":{"own:1":0}}]}}}"""
            ),
            1,
        )

    private fun saved(base: CharacterSheet, input: JsonObject): JsonObject {
        val form = initialForm("inventory:own:1", base).copy(input = input)
        val data = applySheetPatches(base.data, formPatches(form, base, emptyMap()))
        return inventoryEntry(data["values"].objectValue()["items"].objectValue(), "own:1")!!
    }

    @Test
    fun customMetadataRoundTripsAndBlankWeightRemovesOnlyThatOverride() {
        val base =
            sheet(
                """{"uid":"own:1","item_id":null,"icon_preset_id":12,"count":2,"params":{"kept":3},"override":{"name":"Верёвка","weight":1.5,"consumable":true}}"""
            )
        val initial = initialForm("inventory:own:1", base).input
        assertEquals(12L, initial["icon_preset_id"].referenceId())
        val edited = saved(base, JsonObject(initial + ("weight" to JsonPrimitive("2,75"))))
        assertEquals(JsonPrimitive(2.75), edited["override"].objectValue()["weight"])
        assertEquals(12L, edited["icon_preset_id"].referenceId())
        assertEquals(3, edited["params"].objectValue()["kept"].number())
        val cleared = saved(base, JsonObject(initial + ("weight" to JsonPrimitive(""))))
        assertTrue("weight" !in cleared["override"].objectValue())
        assertEquals(JsonPrimitive(true), cleared["override"].objectValue()["consumable"])
        for (bad in listOf("-1", "NaN", "Infinity", "oops")) assertFails {
            saved(base, JsonObject(initial + ("weight" to JsonPrimitive(bad))))
        }
    }

    @Test
    fun editingACatalogueEntryDoesNotInventAnOverrideDisablingItsConsumption() {
        val base = sheet("""{"uid":"own:1","item_id":42,"count":1,"override":{}}""")
        val initial = initialForm("inventory:own:1", base).input
        assertEquals(JsonNull, initial["consumable"])
        assertTrue("consumable" !in saved(base, initial)["override"].objectValue())
        assertEquals(
            JsonPrimitive(false),
            saved(
                    base,
                    JsonObject(initial + ("consumable" to JsonPrimitive(false))),
                )["override"]
                .objectValue()["consumable"],
        )
    }
}
