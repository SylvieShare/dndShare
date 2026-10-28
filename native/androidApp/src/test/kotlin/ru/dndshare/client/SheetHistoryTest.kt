package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.WireJson

class SheetHistoryTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    private val path = sheetPath("values", "rows")

    private fun selector(id: String) = buildJsonObject {
        put("idField", "uid")
        put("id", id)
    }

    private val base =
        obj(
            """{"values":{"rows":[{"uid":"a:1","value":1},{"uid":"b:2","value":2},{"uid":"c:3","value":3}],"name":"Лира"}}"""
        )

    @Test
    fun removingAStableIdRestoresItsOriginalPositionAndUnknownProperties() {
        val patches = listOf(SheetPatch("remove", path + selector("b:2")))
        val step = sheetHistoryStep(base, patches)
        val after = applySheetPatches(base, patches)
        val restored = applySheetPatches(after, historyEdit(step, after, false).patches)
        assertEquals(base, restored)
        assertEquals(after, applySheetPatches(restored, historyEdit(step, restored, true).patches))
    }

    @Test
    fun insertionAndMissingFieldsRemainDistinctFromJsonNullWhenUndone() {
        val patches =
            listOf(
                SheetPatch(
                    "insert",
                    path + selector("new"),
                    obj("""{"uid":"new","value":7}"""),
                    beforeId = JsonPrimitive("b:2"),
                ),
                SheetPatch(path = sheetPath("values", "optional"), value = JsonNull),
            )
        val step = sheetHistoryStep(base, patches)
        val after = applySheetPatches(base, patches)
        assertEquals(base, applySheetPatches(after, historyEdit(step, after, false).patches))
    }

    @Test
    fun reorderingCanBeUndoneAfterAnUnrelatedRowValueChanges() {
        val patch =
            SheetPatch(
                "order",
                path,
                JsonArray(listOf("c:3", "a:1", "b:2").map(::JsonPrimitive)),
                "uid",
            )
        val step = sheetHistoryStep(base, listOf(patch))
        val after =
            applySheetPatches(
                applySheetPatches(base, listOf(patch)),
                listOf(
                    SheetPatch(
                        path = path + selector("a:1") + JsonPrimitive("value"),
                        value = JsonPrimitive(9),
                    )
                ),
            )
        val restored = applySheetPatches(after, historyEdit(step, after, false).patches)
        assertEquals(
            listOf("a:1", "b:2", "c:3"),
            sheetValue(restored, path)!!.jsonArray.map {
                it.jsonObject["uid"]!!.jsonPrimitive.content
            },
        )
        assertEquals(
            JsonPrimitive(9),
            sheetValue(restored, path + selector("a:1") + JsonPrimitive("value")),
        )
    }

    @Test
    fun undoDoesNotOverwriteLaterEditsAndDoesNotRepeatTheOriginalSessionEvents() {
        val patches =
            listOf(SheetPatch(path = sheetPath("values", "name"), value = JsonPrimitive("Торин")))
        val step = sheetHistoryStep(base, patches)
        val after = applySheetPatches(base, patches)
        val undo = historyEdit(step, after, false)
        assertEquals("undo", undo.metadata.single()["action"]!!.jsonPrimitive.content)
        val remote =
            applySheetPatches(after, listOf(patches.single().copy(value = JsonPrimitive("Элиза"))))
        assertFailsWith<IllegalArgumentException> { historyEdit(step, remote, false) }
        assertEquals(JsonPrimitive("Элиза"), sheetValue(remote, sheetPath("values", "name")))
    }
}
