package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class CreatedItemExpiryParityTest {
    @Test
    fun expiryMatchesWebAndReleasesOnlyTheVanishedInstancesSpace() {
        val raw =
            javaClass.classLoader!!
                .getResourceAsStream("character-rules.json")!!
                .bufferedReader()
                .use { it.readText() }
        val cases =
            WireJson.parseToJsonElement(raw)
                .jsonObject["cases"]
                .arrayValue()
                .map { it.objectValue() }
                .filter { it.text("kind") == "createdExpiry" }
        assertEquals(4, cases.size)
        for (case in cases) {
            val sheet =
                CharacterSheet(
                    "DND5",
                    1,
                    buildJsonObject { put("values", case.getValue("values")) },
                    1,
                )
            val actual =
                applySheetPatches(sheet.data, expireCreatedItemPatches(sheet, "created"))["values"]
            assertEquals(case["expected"], actual, case.text("name"))
            if (case.text("name") == "expiry-inert") {
                val current = sheet.copy(data = buildJsonObject { put("values", actual!!) })
                val restored =
                    applySheetPatches(current.data, expireCreatedItemPatches(current, "created"))
                val entry =
                    restored["values"]
                        .objectValue()["items"]
                        .objectValue()["sections"]
                        .arrayValue()
                        .single()
                        .objectValue()["items"]
                        .arrayValue()
                        .first()
                        .objectValue()
                assertEquals(
                    JsonPrimitive(false),
                    entry["params"].objectValue()["creation"].objectValue()["expired"],
                )
                assertEquals("keep", entry["params"].objectValue().text("note"))
            }
        }
    }
}
