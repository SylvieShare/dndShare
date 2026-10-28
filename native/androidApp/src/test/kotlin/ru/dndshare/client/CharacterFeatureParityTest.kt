package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class CharacterFeatureParityTest {
    private fun cases(kind: String): List<JsonObject> {
        val raw =
            javaClass.classLoader!!
                .getResourceAsStream("character-rules.json")!!
                .bufferedReader()
                .use { it.readText() }
        return WireJson.parseToJsonElement(raw)
            .jsonObject["cases"]
            .arrayValue()
            .map { it.objectValue() }
            .filter { it.text("kind") == kind }
    }

    private fun sheet(case: JsonObject) =
        CharacterSheet("DND5", 1, buildJsonObject { put("values", case.getValue("values")) }, 1)

    private fun item(raw: JsonElement) = WireJson.decodeFromJsonElement<CatalogueItem>(raw)

    private fun items(case: JsonObject) =
        case["catalogue"].arrayValue().map(::item).associateBy { it.id }

    @Test
    fun widgetsMatchTheActualWebRulesIncludingManualEffectsAndIndependentInstances() {
        val cases = cases("widget")
        assertEquals(5, cases.size)
        for (case in cases) {
            val actual =
                JsonArray(
                    featureWidgets(sheet(case), items(case)).map { widget ->
                        buildJsonObject {
                            put("key", widget.key)
                            put("title", widget.title)
                            put("kind", widget.kind)
                            put("value", widget.value)
                            put("active", widget.active)
                            put("unavailable", widget.unavailable)
                            put(
                                "resource",
                                widget.resource?.let {
                                    buildJsonObject {
                                        put("value", it.value)
                                        put("total", it.total)
                                    }
                                } ?: JsonNull,
                            )
                            put("notes", JsonArray(widget.notes.map { JsonPrimitive(it.title) }))
                        }
                    }
                )
            assertEquals(case["expected"], actual, case.text("name"))
        }
    }

    @Test
    fun selectedAbilityPrerequisitesAndReplacementBudgetsMatchWeb() {
        val cases = cases("selection")
        assertEquals(4, cases.size)
        for (case in cases) {
            val parent = item(case.getValue("parent"))
            val child = item(case.getValue("item"))
            val sheet = sheet(case)
            val actual = buildJsonObject {
                put("count", abilitySelectionCount(parent, sheet))
                put("replacements", abilityReplacementCount(parent, sheet))
                put("eligible", selectedAbilityEligibility(child, parent, sheet).isEmpty())
            }
            assertEquals(case["expected"], actual, case.text("name"))
        }
    }

    @Test
    fun contributedAndManualActionsMatchWebIncludingResourceAndStatusGates() {
        val cases = cases("featureActions")
        assertEquals(3, cases.size)
        for (case in cases) {
            val actual =
                JsonArray(
                    featureActions(sheet(case), items(case)).map { action ->
                        buildJsonObject {
                            put("key", action.key)
                            put("title", action.title)
                            put("type", action.type)
                            put("description", action.description)
                            put("source", action.feature?.item?.name.orEmpty())
                            put(
                                "resource",
                                action.resource?.let {
                                    buildJsonObject {
                                        put("value", it.value)
                                        put("total", it.total)
                                    }
                                } ?: JsonNull,
                            )
                        }
                    }
                )
            assertEquals(case["expected"], actual, case.text("name"))
        }
    }
}
