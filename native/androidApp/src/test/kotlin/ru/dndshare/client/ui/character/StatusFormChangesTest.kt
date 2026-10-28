package ru.dndshare.client.ui.character

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class StatusFormChangesTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    @Test
    fun independentInstancesKeepTheirIdentityWhileDurationAndRemovalAreEditedTogether() {
        val sheet =
            CharacterSheet(
                "DND5",
                1,
                obj(
                    """{"values":{"states":[{"uid":"first","effect_id":100,"params":{"level":2},"unknown":"keep","duration":{"kind":"manual"}},{"uid":"second","effect_id":100,"duration":{"kind":"hours","value":1}}]}}"""
                ),
                1,
            )
        val item = CatalogueItem(100, 15, "Эффект", data = obj("""{"stacking":"multiple"}"""))
        val added = createStatusInstance(item, buildJsonObject { put("kind", "manual") })
        val form =
            initialForm("statuses", sheet)
                .copy(
                    input =
                        buildJsonObject {
                            put(
                                "statusEdits",
                                obj(
                                    """{"first":{"duration":{"kind":"minutes","value":"3"}},"second":{"remove":true}}"""
                                ),
                            )
                            put("addedStatuses", JsonArray(listOf(added)))
                        }
                )
        val patches = statusFormPatches(form, sheet, mapOf(100L to item))
        assertTrue(patches.all { it.path.last() is JsonObject })
        val states =
            applySheetPatches(sheet.data, patches)["values"]
                .objectValue()["states"]
                .arrayValue()
                .map { it.objectValue() }
        assertEquals(2, states.size)
        val first = states.single { it.text("uid") == "first" }
        assertEquals("keep", first.text("unknown"))
        assertEquals(2, first["params"].objectValue()["level"].number())
        assertEquals(obj("""{"kind":"minutes","value":3}"""), first["duration"])
        assertEquals(added, states.single { it.text("uid") == added.text("uid") })
        val invalid =
            form.copy(
                input =
                    obj("""{"statusEdits":{"first":{"duration":{"kind":"rounds","value":"0"}}}}""")
            )
        assertFails { statusFormPatches(invalid, sheet, mapOf(100L to item)) }
    }

    @Test
    fun addingConcentrationEndsThePreviousInstanceAndNormalizesImportedIds() {
        val sheet =
            CharacterSheet(
                "DND5",
                1,
                obj("""{"values":{"states":[{"effect_id":100,"concentration":true}]}}"""),
                1,
            )
        val old = CatalogueItem(100, 15, "Первый")
        val next = CatalogueItem(200, 15, "Второй", data = obj("""{"concentration":true}"""))
        val added = createStatusInstance(next, buildJsonObject { put("kind", "manual") })
        val form =
            initialForm("statuses", sheet)
                .copy(input = buildJsonObject { put("addedStatuses", JsonArray(listOf(added))) })
        val states =
            applySheetPatches(
                    sheet.data,
                    statusFormPatches(form, sheet, mapOf(100L to old, 200L to next)),
                )["values"]
                .objectValue()["states"]
                .arrayValue()
        assertEquals(added, states.single())
    }
}
