package ru.dndshare.client.ui.character

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class FeatureFormsTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    private fun sheet(values: String, version: String = "2014") =
        CharacterSheet("DND5", 1, obj("""{"values":$values}"""), 1, sourceVersion = version)

    private fun apply(
        sheet: CharacterSheet,
        target: String,
        input: JsonObject,
        items: Map<Long, CatalogueItem> = emptyMap(),
    ): CharacterSheet {
        val form = initialForm(target, sheet).copy(input = input)
        return sheet.copy(data = applySheetPatches(sheet.data, formPatches(form, sheet, items)))
    }

    @Test
    fun editingMoneyKeepsUnknownCurrenciesAndRejectsNegativeBalances() {
        val base = sheet("""{"money":{"order":[1,2],"amounts":{"1":5,"2":9,"custom":7}}}""")
        val next = apply(base, "money", obj("""{"1":"21","2":"4"}"""))
        assertEquals(21, next.values["money"].objectValue()["amounts"].objectValue()["1"].number())
        assertEquals(
            7,
            next.values["money"].objectValue()["amounts"].objectValue()["custom"].number(),
        )
        assertFails { apply(base, "money", obj("""{"1":"-1"}""")) }
    }

    @Test
    fun inventoryEquipMoveAndUnequipPreservePhysicalSpaceAndParameters() {
        val base =
            sheet(
                """{"items":{"equipped":[],"sections":[{"id":"bag","name":"Рюкзак","slots":{"rope":3},"items":[{"uid":"rope","item_id":10,"count":2,"params":{"length_ft":50},"unknown":"keep"}]},{"id":"chest","name":"Сундук","items":[],"slots":{}}]}}"""
            )
        val fields = initialFeatureInput("inventory:rope", base)
        val equipped =
            apply(base, "inventory:rope", JsonObject(fields + ("equipped" to JsonPrimitive(true))))
        val entry =
            equipped.values["items"].objectValue()["equipped"].arrayValue().single().objectValue()
        assertEquals(50, entry["params"].objectValue()["length_ft"].number())
        assertEquals("keep", entry.text("unknown"))
        assertEquals(
            3,
            equipped.values["items"]
                .objectValue()["sections"]
                .arrayValue()[0]
                .objectValue()["slots"]
                .objectValue()["rope"]
                .number(),
        )
        val moved =
            apply(
                equipped,
                "inventory:rope",
                JsonObject(
                    initialFeatureInput("inventory:rope", equipped) +
                        mapOf(
                            "equipped" to JsonPrimitive(false),
                            "section" to JsonPrimitive("chest"),
                        )
                ),
            )
        assertTrue(moved.values["items"].objectValue()["equipped"].arrayValue().isEmpty())
        val sections = moved.values["items"].objectValue()["sections"].arrayValue()
        assertTrue(sections[0].objectValue()["slots"].objectValue().isEmpty())
        assertEquals(
            "rope",
            sections[1].objectValue()["items"].arrayValue().single().objectValue().text("uid"),
        )
    }

    @Test
    fun storageRemovalClearsContentsAndZeroQuantityInputIsRejected() {
        val base =
            sheet(
                """{"items":{"equipped":[],"sections":[{"id":"bag","name":"Рюкзак","items":[{"uid":"x","item_id":2,"count":1}],"slots":{"x":0}}]}}"""
            )
        val removed = apply(base, "inventory-section:bag", obj("""{"id":"bag","remove":true}"""))
        val model = removed.values["items"].objectValue()
        assertTrue(model["equipped"].arrayValue().isEmpty())
        assertTrue(
            model["sections"].arrayValue().single().objectValue()["items"].arrayValue().isEmpty()
        )
        assertFails {
            apply(
                base,
                "inventory:x",
                JsonObject(
                    initialFeatureInput("inventory:x", base) + ("count" to JsonPrimitive("0"))
                ),
            )
        }
    }

    @Test
    fun spellKeysContainingColonsRemainWholeAndDuplicateSpellsAreRejected() {
        val base =
            sheet(
                """{"spells":{"schema_version":2,"slot_pools":{},"tabs":[{"key":"class:8","name":"Магия","spells":[{"key":"spell:one","id":10,"prepared":false}]}],"grants":[]}}"""
            )
        val item = CatalogueItem(10, 5, "Щит", data = obj("""{"lvl":1}"""))
        val input = initialFeatureInput("spell:class:8|spell:one", base)
        assertEquals("class:8", input.text("tab"))
        assertEquals("spell:one", input.text("key"))
        val next =
            apply(
                base,
                "spell:class:8|spell:one",
                JsonObject(input + ("prepared" to JsonPrimitive(true))),
                mapOf(10L to item),
            )
        assertEquals(
            JsonPrimitive(true),
            next.values["spells"]
                .objectValue()["tabs"]
                .arrayValue()
                .single()
                .objectValue()["spells"]
                .arrayValue()
                .single()
                .objectValue()["prepared"],
        )
        assertFails {
            apply(
                base,
                "spell:class:8|new",
                JsonObject(
                    initialFeatureInput("spell:class:8|new", base) + ("id" to JsonPrimitive(10))
                ),
                mapOf(10L to item),
            )
        }
    }

    @Test
    fun longRestDistinguishesEditionsAndRecoversBothSlotPools() {
        val values =
            """{"hp":{"current":2,"temp":4,"max":{"base":30,"bonuses":[]},"hitDice":[{"die":"d8","total":5,"used":5}],"ds_success":1,"ds_failure":2},"exhaustion":{"level":2},"spells":{"tabs":[],"slot_pools":{"long_rest":[{"level":1,"total":3,"used":2}],"short_rest":[{"level":2,"total":2,"used":2}]}},"resources":[{"title":"Ресурс","total":4,"value":0,"long_rest":true}]}"""
        val base = sheet(values)
        val next = apply(base, "rest", obj("""{"kind":"long"}"""))
        assertEquals(30, next.values["hp"].objectValue()["current"].number())
        assertEquals(
            3,
            next.values["hp"]
                .objectValue()["hitDice"]
                .arrayValue()
                .single()
                .objectValue()["used"]
                .number(),
        )
        assertEquals(
            0,
            next.values["spells"]
                .objectValue()["slot_pools"]
                .objectValue()["short_rest"]
                .arrayValue()
                .single()
                .objectValue()["used"]
                .number(),
        )
        assertEquals(1, next.values["exhaustion"].objectValue()["level"].number())
        assertEquals(
            4,
            next.values["resources"].arrayValue().single().objectValue()["value"].number(),
        )
        assertEquals(
            0,
            apply(sheet(values, "2024"), "rest", obj("""{"kind":"long"}"""))
                .values["hp"]
                .objectValue()["hitDice"]
                .arrayValue()
                .single()
                .objectValue()["used"]
                .number(),
        )
    }

    @Test
    fun shortRestNeverSpendsMoreHitDiceThanAvailable() {
        val base =
            sheet(
                """{"hp":{"current":5,"max":{"base":20},"hitDice":[{"die":"d8","total":1,"used":0}]}}"""
            )
        val one =
            apply(
                base,
                "rest",
                obj("""{"kind":"short","hitDiceSpent":[{"die":"d8","healing":6}]}"""),
            )
        assertEquals(11, one.values["hp"].objectValue()["current"].number())
        assertFails {
            apply(
                one,
                "rest",
                obj("""{"kind":"short","hitDiceSpent":[{"die":"d8","healing":6}]}"""),
            )
        }
    }

    @Test
    fun resourceOperationsCreateMissingParentsWithoutConfusingQuantityAndCharges() {
        val base =
            sheet(
                """{"lvl":{"level":3},"items":{"equipped":[{"uid":"wand","item_id":19,"count":2,"params":{}}],"sections":[]}}"""
            )
        val wand =
            CatalogueItem(
                19,
                19,
                "Жезл",
                data = obj("""{"max_use":5,"activation":"carried","attunement":"none"}"""),
            )
        val control = resourceControls(base, mapOf(19L to wand)).single()
        val next =
            base.copy(
                data = applySheetPatches(base.data, listOf(resourceValuePatch(base, control, 3)))
            )
        val entry =
            next.values["items"].objectValue()["equipped"].arrayValue().single().objectValue()
        assertEquals(2, entry["count"].number())
        assertEquals(3, entry["params"].objectValue()["magic"].objectValue()["remaining"].number())
    }

    @Test
    fun diceRejectInvalidAndUnboundedInput() {
        for (text in
            listOf("", "2001d20", "1d1", "1d100000", "2d6;alert(1)", "20000")) assertFails {
            rollDice(text)
        }
        val result = rollDice("2d6+3")
        assertEquals(2, result.dice.size)
        assertTrue(result.total in 5..15)
    }

    @Test
    fun vtmHealthBloodAndNamedAdvantagesUseTheirCanonicalFields() {
        val base =
            sheet(
                    """{"health":["","bashing"],"blood_pool":{"current":3,"max":20},"disciplines":[{"name":"Стойкость","value":1}]}"""
                )
                .copy(templateName = "VTM20")
        val blood = apply(base, "vtm-blood", obj("""{"current":"7","max":"15"}"""))
        assertEquals(7, blood.values["blood_pool"].objectValue()["current"].number())
        assertFails { apply(base, "vtm-blood", obj("""{"current":"21","max":"20"}""")) }
        val input = initialFeatureInput("vtm-health", base)
        val health =
            apply(base, "vtm-health", JsonObject(input + ("0" to JsonPrimitive("aggravated"))))
        assertEquals(JsonPrimitive("aggravated"), health.values["health"].arrayValue()[0])
        val list = initialFeatureInput("vtm-list:disciplines", base)
        val advantage =
            apply(
                base,
                "vtm-list:disciplines",
                JsonObject(
                    list +
                        mapOf(
                            "name0" to JsonPrimitive("Стремительность"),
                            "value0" to JsonPrimitive("3"),
                        )
                ),
            )
        assertEquals(
            "Стремительность",
            advantage.values["disciplines"].arrayValue()[0].objectValue().text("name"),
        )
        assertEquals(
            3,
            advantage.values["disciplines"].arrayValue()[0].objectValue()["value"].number(),
        )
    }
}
