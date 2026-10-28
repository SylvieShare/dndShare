package ru.dndshare.client.ui.character

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.SheetStateServer
import ru.dndshare.client.character.*

class FormFieldEditsTest {
    @Test
    fun callbacksFromOneCompositionFlushSeveralFieldsWithoutRestoringOldRowValues() {
        val sheet = SheetStateServer().sheet
        val original = buildJsonObject {
            put(
                "slots",
                buildJsonArray {
                    add(
                        buildJsonObject {
                            put("level", 1)
                            put("total", 2)
                            put("used", 0)
                        }
                    )
                },
            )
            put(
                "payload",
                buildJsonObject {
                    put(
                        "quest",
                        buildJsonObject {
                            put("reward", "Золото")
                            put(
                                "objectives",
                                buildJsonArray {
                                    add(
                                        buildJsonObject {
                                            put("id", "one")
                                            put("text", "Старый текст")
                                            put("done", false)
                                        }
                                    )
                                    add(
                                        buildJsonObject {
                                            put("id", "two")
                                            put("text", "Сохранить")
                                            put("done", false)
                                        }
                                    )
                                },
                            )
                        },
                    )
                },
            )
        }
        var latest = original
        val editor =
            SheetEditorState(initialForm("spell-slots", sheet).copy(input = original), sheet)
        val composition =
            FeatureFormScope(
                editor,
                { key, value -> latest = JsonObject(latest + (key to value)) },
                { latest },
            )
        // Both callbacks belong to the same old composition, as during an immediate native-buffer
        // flush.
        composition.row(listOf("slots"), 0, "total", JsonPrimitive(4))
        composition.row(listOf("slots"), 0, "used", JsonPrimitive(3))
        assertEquals(4, latest["slots"].arrayValue()[0].objectValue()["total"].number())
        assertEquals(3, latest["slots"].arrayValue()[0].objectValue()["used"].number())
        composition.row(
            listOf("payload", "quest", "objectives"),
            0,
            "text",
            JsonPrimitive("Новый текст"),
        )
        composition.row(listOf("payload", "quest", "objectives"), 0, "done", JsonPrimitive(true))
        composition.rows(listOf("payload", "quest", "objectives")) { it.take(1) }
        val quest = latest["payload"].objectValue()["quest"].objectValue()
        assertEquals("Золото", quest["reward"]?.jsonPrimitive?.content)
        val row = quest["objectives"].arrayValue().single().objectValue()
        assertEquals("Новый текст", row["text"]?.jsonPrimitive?.content)
        assertEquals(JsonPrimitive(true), row["done"])
        assertEquals(
            "Старый текст",
            original["payload"]
                .objectValue()["quest"]
                .objectValue()["objectives"]
                .arrayValue()[0]
                .objectValue()["text"]
                ?.jsonPrimitive
                ?.content,
        )
    }
}
