package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class InventoryParityTest {
    private fun cases(kind: String) =
        WireJson.parseToJsonElement(
                javaClass.classLoader!!
                    .getResourceAsStream("character-rules.json")!!
                    .bufferedReader()
                    .use { it.readText() }
            )
            .jsonObject["cases"]
            .arrayValue()
            .map { it.objectValue() }
            .filter { it.text("kind") == kind }

    @Test
    fun inventoryPickerIncludesAllRelatedPhysicalTypesAndStopsAtCycles() {
        val types =
            listOf(
                ItemType(2, "Вещи"),
                ItemType(10, "Зелья", 2),
                ItemType(14, "Инструменты", 2),
                ItemType(22, "Наборы", 14),
                ItemType(5, "Заклинания"),
            )
        assertEquals(listOf(2L, 10L, 14L, 22L), inventoryTypeIds(types))
        assertEquals(listOf(2L, 10L, 14L, 22L), inventoryTypeIds(types + ItemType(2, "Цикл", 22)))
    }

    @Test
    fun explicitPositionsAndResponsiveColumnsMatchTheWeb() {
        val widths = cases("inventoryColumns")
        assertEquals(7, widths.size)
        for (case in widths) assertEquals(
            case["expected"].number(),
            inventoryColumns(case["width"].number().toFloat()),
            case.text("name"),
        )
        val case = cases("inventorySlots").single()
        val entries = case["entries"].arrayValue().map { it.objectValue() }
        val positions = case["positions"].objectValue()
        assertEquals(
            case["expected"],
            JsonObject(
                resolveInventorySlots(entries, positions).mapValues { JsonPrimitive(it.value) }
            ),
        )
        assertEquals(
            case["cells"],
            JsonArray(
                inventoryCells(entries, positions, case["columns"].number()).map {
                    it?.text("uid")?.let(::JsonPrimitive) ?: JsonNull
                }
            ),
        )
    }

    @Test
    fun movingAndSwappingAcrossSpacesPreservesEquippedIdentityAndEntryData() {
        val cases = cases("inventoryMove")
        assertEquals(6, cases.size)
        for (case in cases) {
            val model = case["model"].objectValue()
            val before = model.toString()
            val move = case["move"].objectValue()
            val next =
                moveInventoryCell(
                    model,
                    move.text("uid"),
                    move.text("fromId"),
                    move.text("toId"),
                    move["toSlot"].number(),
                )
            assertEquals(case["expected"], next, case.text("name"))
            assertEquals(before, model.toString())
        }
    }

    @Test
    fun equippingAndUnequippingKeepsThePhysicalSpaceLikeTheWeb() {
        val cases = cases("inventoryToggle")
        assertEquals(3, cases.size)
        for (case in cases) {
            var next = case["model"].objectValue()
            for (uid in case["sequence"].arrayValue()) next =
                toggleInventoryEquipment(next, uid.jsonPrimitive.content)
            assertEquals(case["expected"], next, case.text("name"))
        }
    }

    @Test
    fun unpositionedEquipmentIsProjectedIntoTheFirstSpace() {
        val case = cases("inventoryNormalize").single()
        val next = normalizeInventorySpaces(case["model"].objectValue())
        assertEquals(case["expected"], next)
        for (raw in case["spaces"].arrayValue()) {
            val row = raw.objectValue()
            assertEquals(
                row["entries"],
                JsonArray(
                    inventorySpaceEntries(next, row.text("id")).map {
                        JsonPrimitive(it.text("uid"))
                    }
                ),
            )
        }
    }

    @Test
    fun packagingCustomUnitPricesAndMeasuredLengthsMatchWebEconomy() {
        val cases = cases("inventoryEconomy")
        assertEquals(7, cases.size)
        for (case in cases) {
            val item = WireJson.decodeFromJsonElement<CatalogueItem>(case.getValue("item"))
            val result = inventoryItemEconomy(item, case["entry"].objectValue())
            val expected = case["expected"].objectValue()
            assertEquals(
                expected["cost"].takeUnless { it == JsonNull },
                result.cost,
                case.text("name"),
            )
            assertEquals(
                (expected["weight"] as? JsonPrimitive)?.doubleOrNull,
                result.weight,
                case.text("name"),
            )
        }
    }

    @Test
    fun anEmptyInventoryHasAStableSpaceAndRejectedMovesNeverMutateIt() {
        val source = JsonObject(emptyMap())
        val model = normalizeInventorySpaces(source)
        assertEquals("default", model["sections"].arrayValue().single().objectValue().text("id"))
        assertEquals(model, normalizeInventorySpaces(model))
        assertFails { moveInventoryCell(model, "missing", "default", "other", 0) }
        assertEquals(JsonObject(emptyMap()), source)
    }
}
