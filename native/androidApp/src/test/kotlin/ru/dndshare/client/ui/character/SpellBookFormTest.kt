package ru.dndshare.client.ui.character

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class SpellBookFormTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    private fun sheet(values: String) =
        CharacterSheet("DND5", 1, buildJsonObject { put("values", obj(values)) }, 1)

    private val spell = CatalogueItem(5, 5, "Свет", data = obj("""{"lvl":1}"""))

    private fun save(base: CharacterSheet, target: String, extra: JsonObject): CharacterSheet {
        val initial = initialForm(target, base)
        return base.copy(
            data =
                applySheetPatches(
                    base.data,
                    formPatches(
                        initial.copy(input = JsonObject(initial.input + extra)),
                        base,
                        mapOf(5L to spell, 100L to CatalogueItem(100, 15, "Эффект")),
                    ),
                )
        )
    }

    @Test
    fun booksWriteTheSameNumericCastingAbilityConsumedByTheWebAndServer() {
        val base =
            sheet(
                """{"lvl":{"level":4},"INT":{"value":{"base":16}},"spells":{"tabs":[],"grants":[]}}"""
            )
        val book =
            save(
                base,
                "spell-tab:new",
                obj("""{"name":"Книга","casting_ability":"4","mode":"prepared"}"""),
            )
        val tab = book.values["spells"].objectValue()["tabs"].arrayValue().single().objectValue()
        assertEquals(JsonPrimitive(4), tab["casting_ability"])
        val key = tab.text("key")
        val next = save(book, "spell:$key|new", obj("""{"id":5,"prepared":true}"""))
        val entry =
            next.values["spells"]
                .objectValue()["tabs"]
                .arrayValue()
                .single()
                .objectValue()["spells"]
                .arrayValue()
                .single()
                .objectValue()
        val readout = spellReadout(next, entry.text("key"), mapOf(5L to spell), HandbookMetadata())
        assertEquals(5, readout.attack)
        assertEquals(13, readout.save)
        assertFails {
            save(
                base,
                "spell-tab:new",
                obj("""{"name":"Wrong","casting_ability":"INT","mode":"known"}"""),
            )
        }
    }

    @Test
    fun movingASpellKeepsOneStableEntryAndDeletingItRemovesOnlyItsStatusSource() {
        val base =
            sheet(
                """{"spells":{"tabs":[{"key":"a","name":"Первая","mode":"spellbook","casting_ability":4,"spells":[{"key":"row","id":5,"prepared":true,"custom":"keep"}]},{"key":"b","name":"Вторая","mode":"known","casting_ability":6,"spells":[]}],"grants":[]},"states":[{"uid":"owned","effect_id":100,"source":{"kind":"spell","item_id":5,"entry_key":"row"}},{"uid":"other","effect_id":100,"source":{"kind":"spell","item_id":5,"entry_key":"other"}}]}"""
            )
        val moved = save(base, "spell:a|row", obj("""{"tab":"b"}"""))
        val tabs =
            moved.values["spells"].objectValue()["tabs"].arrayValue().map { it.objectValue() }
        assertTrue(tabs[0]["spells"].arrayValue().isEmpty())
        val entry = tabs[1]["spells"].arrayValue().single().objectValue()
        assertEquals("row", entry.text("key"))
        assertEquals("keep", entry.text("custom"))
        assertEquals(JsonPrimitive(false), entry["prepared"])
        assertEquals(base.values["states"], moved.values["states"])
        val removed = save(moved, "spell:b|row", obj("""{"remove":true}"""))
        assertEquals(
            "other",
            removed.values["states"].arrayValue().single().objectValue().text("uid"),
        )
    }

    @Test
    fun deletingABookUnlinksGrantsAndDuplicateClassBooksAreRejected() {
        val base =
            sheet(
                """{"spells":{"tabs":[{"key":"a","name":"Класс","class_item_id":11,"casting_ability":4,"mode":"known","spells":[]}],"grants":[{"key":"gift","id":5,"tab_key":"a","source":{"kind":"class","item_id":11}}]}}"""
            )
        assertFails {
            save(
                base,
                "spell-tab:new",
                obj("""{"name":"Повтор","class_item_id":11,"casting_ability":4,"mode":"known"}"""),
            )
        }
        val removed = save(base, "spell-tab:a", obj("""{"remove":true}"""))
        val grant =
            removed.values["spells"].objectValue()["grants"].arrayValue().single().objectValue()
        assertNull(grant["tab_key"])
        assertEquals(5L, grant.referenceId())
        assertEquals("class", grant["source"].objectValue().text("kind"))
    }
}
