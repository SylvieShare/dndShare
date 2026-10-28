package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.model.*

class CreationTransitionsTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    private val items =
        listOf(
            CatalogueItem(1, 8, "Раса"),
            CatalogueItem(2, 9, "Класс"),
            CatalogueItem(3, 9, "Другой класс"),
            CatalogueItem(10, 3, "Расовая способность", data = obj("""{"race_ids":[1]}""")),
            CatalogueItem(20, 4, "Классовая способность", data = obj("""{"class_ids":[2]}""")),
            CatalogueItem(30, 4, "Новая способность", data = obj("""{"class_ids":[3]}""")),
            CatalogueItem(7, 7, "Черта"),
        )
    private val draft =
        CreationDraft(
            selected = mapOf("race" to 1, "charClass" to 2),
            name = "Имя",
            media = mapOf("path" to "/image.png"),
            choices =
                mapOf(
                    "feats" to listOf("7"),
                    "7|focus" to listOf("1"),
                    "origin:7|focus" to listOf("2"),
                    "10|language" to listOf("6"),
                    "20|style" to listOf("defense"),
                    "classSkills" to listOf("1"),
                ),
        )

    private fun context(d: CreationDraft = draft) =
        CreationContext(d, items, HandbookMetadata(), JsonObject(emptyMap()))

    @Test
    fun selectingTheClassAfterRaceKeepsRaceAndOriginFeatChoices() {
        val first = draft.copy(selected = mapOf("race" to 1))
        val chosen = chooseCreationItem(context(first), "charClass", 2)
        assertEquals(listOf("1"), chosen.choices["7|focus"])
        assertEquals(listOf("2"), chosen.choices["origin:7|focus"])
        assertEquals(listOf("6"), chosen.choices["10|language"])
        assertNull(chosen.choices["20|style"])
        assertEquals(first.name, chosen.name)
        assertEquals(first.media, chosen.media)
    }

    @Test
    fun sourceReplacementInvalidatesItsOwnSelectionsAndPreservesOtherSteps() {
        val next = chooseCreationItem(context(), "charClass", 3)
        assertNull(next.choices["20|style"])
        assertNull(next.choices["classSkills"])
        assertEquals(draft.choices["7|focus"], next.choices["7|focus"])
        val race = chooseCreationVariant(context(), "other")
        assertNull(race.choices["7|focus"])
        assertNull(race.choices["10|language"])
        assertEquals(draft.choices["20|style"], race.choices["20|style"])
        assertEquals(draft.choices["origin:7|focus"], race.choices["origin:7|focus"])
        assertEquals(draft, chooseCreationItem(context(), "charClass", 2))
    }
}
