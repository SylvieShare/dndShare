package ru.dndshare.client.ui.character

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class IdentityFormsTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    private val base =
        CharacterSheet(
            "DND5",
            1,
            obj(
                """{"values":{"name":"Лира","race":{"id":210,"name":"Эльф"},"subrace":{"id":216,"name":"Лесной"},"classes":[{"id":211,"name":"Волшебник","level":4,"subclass":{"id":217,"name":"Школа"}}],"lvl":{"level":4,"exp":1234,"kept":true},"hp":{"current":18,"max":{"base":28}},"spells":{"schema_version":2,"grants":[]},"abilities_race":[{"id":333}]}}"""
            ),
            1,
        )
    private val items =
        listOf(
                CatalogueItem(210, 8, "Эльф"),
                CatalogueItem(219, 8, "Человек"),
                CatalogueItem(216, 16, "Лесной", data = obj("""{"race":210}""")),
                CatalogueItem(211, 9, "Волшебник"),
                CatalogueItem(212, 9, "Воин"),
                CatalogueItem(217, 17, "Школа", data = obj("""{"class":211}""")),
                CatalogueItem(218, 17, "Архетип", data = obj("""{"class":212}""")),
            )
            .associateBy { it.id }

    private fun save(input: JsonObject): CharacterSheet {
        val form = initialForm("identity", base).copy(input = input)
        return base.copy(data = applySheetPatches(base.data, formPatches(form, base, items)))
    }

    @Test
    fun changingTheNameKeepsAllUneditedIdentityAndMechanics() {
        val input = initialForm("identity", base).input
        val next = save(JsonObject(input + ("name" to JsonPrimitive("Торин"))))
        assertEquals("Торин", next.name)
        assertEquals(base.values - "name", next.values - "name")
        val race =
            save(
                JsonObject(
                    input +
                        mapOf(
                            "race" to obj("""{"id":219,"name":"Человек"}"""),
                            "subrace" to JsonNull,
                        )
                )
            )
        assertEquals(219L, race.values["race"].referenceId())
        assertEquals(JsonNull, race.values["subrace"])
        assertEquals(base.values["abilities_race"], race.values["abilities_race"])
    }

    @Test
    fun manualClassesChangeOnlyClassesAndLevelKeepingExperienceHealthAndSpellResources() {
        val input = initialForm("identity", base).input
        val rows =
            obj(
                """{"rows":[{"id":211,"name":"Волшебник","level":"2","subclass":{"id":217,"name":"Школа"},"_key":"one"},{"id":212,"name":"Воин","level":"1","subclass":null,"_key":"two"}]}"""
            )["rows"]!!
        val next =
            save(
                JsonObject(
                    input + mapOf("classes" to rows, "_classesChanged" to JsonPrimitive(true))
                )
            )
        assertEquals(3, next.values["lvl"].objectValue()["level"].number())
        assertEquals(1234, next.values["lvl"].objectValue()["exp"].number())
        assertEquals(JsonPrimitive(true), next.values["lvl"].objectValue()["kept"])
        for (key in listOf("hp", "spells", "abilities_race")) assertEquals(
            base.values[key],
            next.values[key],
        )
        assertTrue(next.values["classes"].arrayValue().all { "_key" !in it.objectValue() })
    }

    @Test
    fun manualClassesRejectDuplicateOverCapEmptyAndUnrelatedSubclassesAtomically() {
        val initial = initialForm("identity", base).input
        val invalid =
            listOf(
                "[]",
                """[{"id":211,"level":1},{"id":211,"level":2}]""",
                """[{"id":211,"level":20},{"id":212,"level":1}]""",
                """[{"id":211,"level":1,"subclass":{"id":218,"name":"Чужой"}}]""",
            )
        for (raw in invalid) assertFails {
            save(
                JsonObject(
                    initial +
                        mapOf(
                            "classes" to WireJson.parseToJsonElement(raw),
                            "_classesChanged" to JsonPrimitive(true),
                        )
                )
            )
        }
        assertEquals(4, base.values["lvl"].objectValue()["level"].number())
    }
}
