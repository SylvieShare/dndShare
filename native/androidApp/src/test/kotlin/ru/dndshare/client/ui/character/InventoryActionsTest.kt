package ru.dndshare.client.ui.character

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class InventoryActionsTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    private fun sheet(model: String) =
        CharacterSheet(
            "DND5",
            1,
            buildJsonObject { put("values", buildJsonObject { put("items", obj(model)) }) },
            1,
        )

    private val base =
        sheet(
            """{"equipped":[{"uid":"worn","item_id":12,"count":1,"params":{"saved":2}}],"sections":[{"id":"bag","name":"Сумка","items":[{"uid":"one","item_id":2,"count":2,"override":{"name":"Моя вещь"}}],"slots":{"one":0,"worn":1}},{"id":"other","name":"Сундук","items":[],"slots":{}}]}"""
        )

    private fun changed(
        base: CharacterSheet,
        uid: String,
        op: String,
        input: JsonObject = JsonObject(emptyMap()),
        items: Map<Long, CatalogueItem> = emptyMap(),
    ) =
        base.copy(
            data = applySheetPatches(base.data, inventoryActionPatches(base, uid, op, input, items))
        )

    @Test
    fun movingThroughTheActionRouterChangesTheRequestedCell() {
        val next =
            changed(
                base,
                "worn",
                "inventory-cell",
                obj("""{"fromId":"bag","toId":"other","toSlot":3}"""),
            )
        val model = next.values["items"].objectValue()
        assertEquals(base.values["items"].objectValue()["equipped"], model["equipped"])
        assertEquals(
            3,
            model["sections"].arrayValue()[1].objectValue()["slots"].objectValue()["worn"].number(),
        )
        assertTrue(
            "worn" !in model["sections"].arrayValue()[0].objectValue()["slots"].objectValue()
        )
    }

    @Test
    fun onlyEligibleItemsCanBeEquippedAndUnknownWornItemsCanBeRemoved() {
        val food = CatalogueItem(2, 2, "Еда")
        assertFails { changed(base, "one", "inventory-equip", items = mapOf(2L to food)) }
        val next = changed(base, "worn", "inventory-equip")
        assertTrue(next.values["items"].objectValue()["equipped"].arrayValue().isEmpty())
        assertEquals(
            2,
            inventoryEntry(next.values["items"].objectValue(), "worn")!!["params"]
                .objectValue()["saved"]
                .number(),
        )
    }

    @Test
    fun removingTheLastUnitClearsItsSlotWithoutTouchingOtherEntries() {
        val next = changed(base, "worn", "inventory-count", obj("""{"delta":-1}"""))
        val model = next.values["items"].objectValue()
        assertNull(inventoryEntry(model, "worn"))
        assertTrue(
            "worn" !in model["sections"].arrayValue()[0].objectValue()["slots"].objectValue()
        )
        assertEquals(
            inventoryEntry(base.values["items"].objectValue(), "one"),
            inventoryEntry(model, "one"),
        )
    }

    @Test
    fun deletingASpaceAlsoRemovesItsEquippedItemsAndKeepsAnotherSpace() {
        val next = changed(base, "bag", "inventory-section-delete")
        val model = next.values["items"].objectValue()
        assertTrue(model["equipped"].arrayValue().isEmpty())
        assertNull(inventoryEntry(model, "one"))
        assertEquals("other", model["sections"].arrayValue().single().objectValue().text("id"))
    }

    @Test
    fun addingFromAnEmptyCellRetainsSpaceAndSlotThroughTheDurableForm() {
        val form = initialForm("inventory:new|other|3", base)
        assertEquals("other", form.input.text("section"))
        assertEquals(3, form.input["slot"].number())
        val input =
            JsonObject(
                form.input +
                    mapOf("name" to JsonPrimitive("Талисман"), "count" to JsonPrimitive("2"))
            )
        val next =
            base.copy(
                data =
                    applySheetPatches(
                        base.data,
                        formPatches(form.copy(input = input), base, emptyMap()),
                    )
            )
        val space = next.values["items"].objectValue()["sections"].arrayValue()[1].objectValue()
        val entry = space["items"].arrayValue().single().objectValue()
        assertEquals("Талисман", entry["override"].objectValue().text("name"))
        assertEquals(3, space["slots"].objectValue()[entry.text("uid")].number())
    }

    @Test
    fun quantityChangesCarryTheSameChronicleTypeAndRemainingCountAsTheWeb() {
        val added =
            itemMechanicMetadata(
                    base,
                    "one",
                    "inventory-count",
                    obj("""{"delta":1}"""),
                    emptyMap(),
                    "campaign",
                )
                .single()["events"]
                .arrayValue()
                .single()
                .objectValue()
        assertEquals("item_added", added.text("type"))
        assertEquals(3, added["data"].objectValue()["remaining"].number())
        val removed =
            itemMechanicMetadata(
                    base,
                    "one",
                    "inventory-delete",
                    JsonObject(emptyMap()),
                    emptyMap(),
                    "campaign",
                )
                .single()["events"]
                .arrayValue()
                .single()
                .objectValue()
        assertEquals("item_removed", removed.text("type"))
        assertEquals(2, removed["data"].objectValue()["count"].number())
    }

    @Test
    fun spaceRemovalChronicleListsBothCarriedAndEquippedItems() {
        val event =
            itemMechanicMetadata(
                    base,
                    "bag",
                    "inventory-section-delete",
                    JsonObject(emptyMap()),
                    emptyMap(),
                    "campaign",
                )
                .single()["events"]
                .arrayValue()
                .single()
                .objectValue()
        assertEquals("item_removed", event.text("type"))
        val rows = event["data"].objectValue()["removedEntries"].arrayValue()
        assertEquals(
            setOf("one", "worn"),
            rows.map { it.objectValue()["source"].objectValue().text("instanceUid") }.toSet(),
        )
    }
}
