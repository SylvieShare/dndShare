package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class WeaponUseAndFormulaTest {
    private fun obj(raw: String) = WireJson.parseToJsonElement(raw).jsonObject

    @Test
    fun richFormulaMatchesActualWebResultsAndMissingVariables() {
        val source =
            javaClass.classLoader!!
                .getResourceAsStream("character-rules.json")!!
                .bufferedReader()
                .use { it.readText() }
        val cases =
            obj(source)["cases"]
                .arrayValue()
                .map { it.objectValue() }
                .filter { it.text("kind") == "richFormula" }
        assertEquals(8, cases.size)
        for (case in cases) {
            val expected = case["expected"].objectValue()
            val context =
                case["context"].objectValue().mapValues {
                    it.value.objectValue()["value"]!!.jsonPrimitive.double
                }
            if (expected.text("error").isNotEmpty())
                assertFails(case.text("name")) { richFormula(case.text("formula"), context) }
            else {
                val result = richFormula(case.text("formula"), context)
                assertEquals(
                    expected["value"].takeUnless { it == JsonNull }?.jsonPrimitive?.double,
                    result.value,
                    case.text("name"),
                )
                assertEquals(
                    expected["variables"].arrayValue().map { it.jsonPrimitive.content }.toSet(),
                    result.variables,
                )
            }
        }
    }

    @Test
    fun weaponUsePaysOnceAndSnapshotsIndependentSteps() {
        val sheet =
            CharacterSheet(
                "DND5",
                1,
                obj(
                    """{"values":{"lvl":{"level":3},"STR":{"value":{"base":14}},"weapon":[{"uid":"spear","item_id":1,"magic_item_id":2,"params":{"magic":{"remaining":2}}}]}}"""
                ),
                1,
            )
        val base =
            CatalogueItem(
                1,
                1,
                "Копьё",
                data = obj("""{"attacks":[{"count":1,"dice_id":"d6","type":1}],"tags":[6]}"""),
            )
        val magic =
            CatalogueItem(
                2,
                19,
                "Копьё молнии",
                data =
                    obj(
                        """{"weapon":{"base_item_id":1},"attunement":"none","max_use":2,"weapon_uses":[{"key":"lightning","title":"Молния","attack_mode":"thrown","range_ft":120,"resource_cost":1,"steps":[{"key":"line","title":"Линия","kind":"damage","dice":"d6","dice_count":4,"damage_type":2,"save":{"ability":2,"dc":13,"half":true},"area":{"shape":"line","width_ft":5}},{"key":"hit","title":"Попадание","kind":"weapon_damage","dice":"d6","dice_count":4,"damage_type":2}]}]}"""
                    ),
            )
        val items = mapOf(1L to base, 2L to magic)
        val metadata =
            HandbookMetadata(
                suggests =
                    mapOf(
                        "12" to listOf(Suggest(1, 12, "Колющий"), Suggest(2, 12, "Электричество"))
                    )
            )
        val plan = startWeaponUse(sheet, "spear", "lightning", items, metadata)
        var next = sheet.copy(data = applySheetPatches(sheet.data, plan.patches))
        next =
            next.copy(
                data =
                    applySheetPatches(next.data, listOf(weaponUsePatch(next, "spear", plan.event)))
            )
        assertEquals(1, resourceControls(next, items).single().value)
        assertFails { startWeaponUse(next, "spear", "lightning", items, metadata) }
        val first = plan.event["steps"].arrayValue()[0].objectValue()
        assertEquals(120, first["area"].objectValue()["length_ft"].number())
        val result = SheetRollResult("Линия", "normal", listOf(2, 2, 2, 2), null, 0, total = 8)
        val rolled = completeWeaponUseStep(plan.event, "line", result, false)
        assertEquals(4, rolled["steps"].arrayValue()[0].objectValue()["half_result"].number())
        assertFails { completeWeaponUseStep(rolled, "line", result, false) }
        val missed = completeWeaponUseStep(rolled, "hit", null, false)
        assertEquals("missed", missed["steps"].arrayValue()[1].objectValue().text("status"))
        assertEquals(1, resourceControls(next, items).single().value)
    }
}
