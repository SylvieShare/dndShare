package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.model.*

class CreationFeatureParityTest {
    @Test
    fun repeatableFeatChoicesResourcesAndGrantedSpellsMatchTheWebProducer() {
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
                .filter { it.text("kind") == "creationFeatures" }
        assertEquals(3, cases.size)
        for (case in cases) {
            val catalogue =
                case["catalogue"].arrayValue().map {
                    WireJson.decodeFromJsonElement<CatalogueItem>(it)
                }
            val draft = WireJson.decodeFromJsonElement<CreationDraft>(case.getValue("draft"))
            val result =
                assembleCharacter(
                        CreationContext(
                            draft,
                            catalogue,
                            HandbookMetadata(),
                            JsonObject(emptyMap()),
                        )
                    )
                    .getValue("values")
                    .jsonObject
            val aliases =
                result["abilities_feats"]
                    .arrayValue()
                    .map { it.objectValue() }
                    .mapIndexedNotNull { index, entry ->
                        entry.text("uid").takeIf(String::isNotBlank)?.let { it to "entry-$index" }
                    }
                    .toMap()
            fun normalize(value: JsonElement): JsonElement =
                when (value) {
                    is JsonArray -> JsonArray(value.map(::normalize))
                    is JsonObject -> JsonObject(value.mapValues { normalize(it.value) })
                    is JsonPrimitive ->
                        if (value.isString)
                            JsonPrimitive(
                                aliases[value.content]
                                    ?: value.content
                                        .removePrefix("feat:")
                                        .takeIf {
                                            value.content.startsWith("feat:") && it in aliases
                                        }
                                        ?.let { "feat:" + aliases[it] }
                                    ?: value.content
                            )
                        else value
                    else -> value
                }
            val keys = case["keys"].arrayValue().map { it.jsonPrimitive.content }.toSet()
            assertEquals(
                case["expected"],
                normalize(JsonObject(result.filterKeys { it in keys })),
                case.text("name"),
            )
            if (case.text("name").endsWith("repeatable-origin")) {
                val feats = result["abilities_feats"].arrayValue().map { it.objectValue() }
                assertEquals(2, feats.map { it.text("uid") }.distinct().size)
                assertEquals(
                    listOf(JsonPrimitive(1)),
                    feats[0]["choices"].objectValue()["focus"].arrayValue(),
                )
                assertEquals(
                    listOf(JsonPrimitive(2)),
                    feats[1]["choices"].objectValue()["focus"].arrayValue(),
                )
            }
        }
    }
}
