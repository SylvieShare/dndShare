package ru.dndshare.client.ui.character

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class InventoryWeaponPlacementTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    private fun sheet(entry: JsonObject) =
        CharacterSheet(
            "DND5",
            1,
            buildJsonObject {
                put(
                    "values",
                    buildJsonObject {
                        put("weapon", JsonArray(emptyList()))
                        put(
                            "items",
                            obj(
                                    """{"equipped":[],"sections":[{"id":"bag","name":"Сумка","items":[],"slots":{}}]}"""
                                )
                                .let { model ->
                                    val space =
                                        model["sections"].arrayValue().single().objectValue()
                                    JsonObject(
                                        model +
                                            ("sections" to
                                                JsonArray(
                                                    listOf(
                                                        JsonObject(
                                                            space +
                                                                mapOf(
                                                                    "items" to
                                                                        JsonArray(listOf(entry)),
                                                                    "slots" to
                                                                        buildJsonObject {
                                                                            put(
                                                                                entry.text("uid"),
                                                                                3,
                                                                            )
                                                                        },
                                                                )
                                                        )
                                                    )
                                                ))
                                    )
                                },
                        )
                    },
                )
            },
            1,
        )

    private val sword =
        CatalogueItem(1, 1, "Меч", data = obj("""{"attacks":[{"count":1,"dice_id":3,"type":1}]}"""))

    @Test
    fun movingAStackSplitsInstancesAndKeepsTheFirstOpaqueUidAndSettings() {
        val base =
            sheet(
                obj(
                    """{"uid":"blade:one","item_id":1,"count":3,"params":{"custom":2},"override":{"name":"Мой меч"}}"""
                )
            )
        val form = initialForm("weapon:blade:one", base)
        assertEquals("blade:one", form.input.text("uid"))
        assertEquals(JsonPrimitive(true), form.input["fromInventory"])
        val changes = formPatches(form, base, mapOf(1L to sword))
        val next = base.copy(data = applySheetPatches(base.data, changes))
        assertNull(inventoryEntry(next.values["items"].objectValue(), "blade:one"))
        val weapons = next.values["weapon"].arrayValue().map { it.objectValue() }
        assertEquals(3, weapons.size)
        assertEquals(3, weapons.map { it.text("uid") }.distinct().size)
        assertEquals("blade:one", weapons.first().text("uid"))
        assertTrue(
            weapons.all {
                "count" !in it &&
                    it["params"].objectValue()["custom"].number() == 2 &&
                    it["override"].objectValue().text("name") == "Мой меч"
            }
        )
        assertTrue(
            formSessionMetadata(form, base, changes, mapOf(1L to sword), "session").isEmpty()
        )
    }

    @Test
    fun movingMagicEquipmentMaterializesItsPhysicalBaseWithoutResettingItsState() {
        val magic =
            CatalogueItem(
                19,
                19,
                "Магический меч",
                data = obj("""{"weapon":{"base_item_id":1},"attunement":"none"}"""),
            )
        val base =
            sheet(
                obj(
                    """{"uid":"magic","item_id":19,"count":1,"params":{"magic":{"attuned":true,"resources":{"pool":0}}},"override":{}}"""
                )
            )
        val form = initialForm("weapon:magic", base)
        val next =
            base.copy(
                data =
                    applySheetPatches(
                        base.data,
                        formPatches(form, base, mapOf(1L to sword, 19L to magic)),
                    )
            )
        val entry = next.values["weapon"].arrayValue().single().objectValue()
        assertEquals(1L, entry["item_id"].referenceId())
        assertEquals(19L, entry["magic_item_id"].referenceId())
        assertEquals("magic", entry.text("uid"))
        assertEquals(
            JsonPrimitive(true),
            entry["params"].objectValue()["magic"].objectValue()["attuned"],
        )
        assertEquals(
            0,
            entry["params"]
                .objectValue()["magic"]
                .objectValue()["resources"]
                .objectValue()["pool"]
                .number(),
        )
    }

    @Test
    fun anUnconfiguredMagicBaseLeavesBothCollectionsUntouched() {
        val magic =
            CatalogueItem(
                19,
                19,
                "Любое оружие",
                data = obj("""{"weapon":{"allowed_base_item_ids":[1]}}"""),
            )
        val base =
            sheet(obj("""{"uid":"magic","item_id":19,"count":1,"params":{},"override":{}}"""))
        val before = base.data.toString()
        val form = initialForm("weapon:magic", base)
        assertFails { formPatches(form, base, mapOf(1L to sword, 19L to magic)) }
        assertEquals(before, base.data.toString())
        assertTrue(base.values["weapon"].arrayValue().isEmpty())
    }
}
