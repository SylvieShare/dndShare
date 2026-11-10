package ru.dndshare.client.ui.character

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class StatusFormChangesTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    @Test
    fun headerRemovalTargetsOnlyOneInstanceAndKeepsOtherConditionFields() {
        val sheet = CharacterSheet("DND5", 1, obj("""{"values":{"states":[{"uid":"first","effect_id":100},{"uid":"second","effect_id":100,"unknown":"keep"}],"exhaustion":{"level":2,"custom":"keep"},"inspiration":true}}"""), 1)
        fun after(uid: String) = applySheetPatches(sheet.data, removeHeaderStatusPatches(sheet, uid, emptyMap()))["values"].objectValue()
        assertEquals(obj("""{"uid":"second","effect_id":100,"unknown":"keep"}"""), after("first")["states"].arrayValue().single())
        assertEquals(JsonPrimitive(false), after("inspiration")["inspiration"])
        assertEquals(obj("""{"level":0,"custom":"keep"}"""), after("exhaustion")["exhaustion"])
        assertEquals(sheet.values["states"], after("exhaustion")["states"])
        assertFailsWith<IllegalArgumentException> { removeHeaderStatusPatches(sheet, "already-removed", emptyMap()) }
    }

    @Test
    fun headerRemovalRecognizesAnImportedInstanceWithoutUid() {
        val sheet = CharacterSheet("DND5", 1, obj("""{"values":{"states":[{"effect_id":100},{"uid":"second","effect_id":100}]}}"""), 1)
        val values = applySheetPatches(sheet.data, removeHeaderStatusPatches(sheet, "status-100-0", emptyMap()))["values"].objectValue()
        assertEquals(obj("""{"uid":"second","effect_id":100}"""), values["states"].arrayValue().single())
    }

    @Test
    fun removingFromTheHeaderAppliesTheSameEndEffectAsTheStatusEditor() {
        val sheet = CharacterSheet("DND5", 1, obj("""{"values":{"states":[{"uid":"first","effect_id":100}]}}"""), 1)
        val effect = CatalogueItem(100, 15, "Исходное", data = obj("""{"on_end_effect":200}"""))
        val next = CatalogueItem(200, 15, "После окончания")
        val values = applySheetPatches(sheet.data, removeHeaderStatusPatches(sheet, "first", mapOf(100L to effect, 200L to next)))["values"].objectValue()
        val state = values["states"].arrayValue().single().objectValue()
        assertEquals(200, state["effect_id"].number())
        assertEquals(100, state["source"].objectValue()["item_id"].number())
    }

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
