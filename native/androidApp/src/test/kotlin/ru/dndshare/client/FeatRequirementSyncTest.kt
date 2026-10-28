package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class FeatRequirementSyncTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    private fun sheet(values: String) =
        CharacterSheet("DND5", 1, buildJsonObject { put("values", obj(values)) }, 1)

    private fun sync(
        sheet: CharacterSheet,
        items: Map<Long, CatalogueItem>,
        meta: HandbookMetadata = HandbookMetadata(),
    ): CharacterSheet =
        sheet.copy(data = applySheetPatches(sheet.data, featRequirementPatches(sheet, items, meta)))

    @Test
    fun deactivationAndReactivationKeepManualBonusesAndIndependentSpentCounters() {
        val item =
            CatalogueItem(
                7,
                7,
                "Подготовка",
                data =
                    obj(
                        """{"prereq":{"min_stats":[{"ability":2,"value":13}]},"asi":[{"ability":1,"bonus":1}]}"""
                    ),
            )
        val base =
            sheet(
                """{"lvl":{"level":4},"DEX":{"value":{"base":10}},"STR":{"value":{"base":12,"bonuses":[{"title":"Ручной","value":2},{"sourceFeatKey":"feat:first","value":1},{"sourceFeatKey":"feat:second","value":1}]}},"abilities_feats":[{"id":7,"uid":"first","count":0},{"id":7,"uid":"second","count":1}]}"""
            )
        val items = mapOf(7L to item)
        val inactive = sync(base, items)
        assertEquals(14, inactive.statScore("STR"))
        assertTrue(
            inactive.values["abilities_feats"].arrayValue().all {
                it.objectValue()["requirements_met"] == JsonPrimitive(false)
            }
        )
        assertTrue(featRequirementPatches(inactive, items, HandbookMetadata()).isEmpty())
        val raised =
            inactive.copy(
                data =
                    applySheetPatches(
                        inactive.data,
                        listOf(
                            SheetPatch(
                                path = sheetPath("values", "DEX"),
                                value = obj("""{"value":{"base":13}}"""),
                            )
                        ),
                    )
            )
        val active = sync(raised, items)
        assertEquals(16, active.statScore("STR"))
        assertEquals(
            listOf(0, 1),
            active.values["abilities_feats"].arrayValue().map {
                it.objectValue()["count"].number()
            },
        )
        assertTrue(
            active.values["abilities_feats"].arrayValue().none {
                "requirements_met" in it.objectValue()
            }
        )
        assertTrue(featRequirementPatches(active, items, HandbookMetadata()).isEmpty())
    }

    @Test
    fun dependentFeatsConvergeAndMissingCatalogueDoesNotDisableThem() {
        val armor =
            CatalogueItem(
                7,
                7,
                "Доспехи",
                data =
                    obj(
                        """{"prereq":{"min_level":5},"derived_effects":[{"kind":"armor_proficiency","target_ids":[1]}]}"""
                    ),
            )
        val dependent =
            CatalogueItem(8, 7, "Защита", data = obj("""{"prereq":{"armor_prof":[1]}}"""))
        val base = sheet("""{"lvl":{"level":4},"abilities_feats":[{"id":8},{"id":7}]}""")
        val meta = HandbookMetadata(suggests = mapOf("3" to listOf(Suggest(1, 3, "Лёгкие"))))
        val next = sync(base, mapOf(7L to armor, 8L to dependent), meta)
        val entries = next.values["abilities_feats"].arrayValue().map { it.objectValue() }
        assertEquals(JsonPrimitive(false), entries[0]["requirements_met"])
        assertEquals(JsonPrimitive(false), entries[1]["requirements_met"])
        val missing =
            base.copy(
                data =
                    applySheetPatches(
                        base.data,
                        listOf(
                            SheetPatch(
                                path = sheetPath("values", "abilities_feats"),
                                value = obj("""{"entries":[{"id":7},{"id":99}]}""")["entries"]!!,
                            )
                        ),
                    )
            )
        assertTrue(featRequirementPatches(missing, mapOf(7L to armor), meta).isEmpty())
        assertEquals(
            1,
            featRequirementPatches(base, mapOf(7L to armor, 8L to dependent), meta).count {
                it.path == sheetPath("values", "abilities_feats")
            },
        )
    }

    @Test
    fun aSpellbookEnablesCastingPrerequisiteAndPendingArmorDictionaryIsNotARejection() {
        val cast = CatalogueItem(7, 7, "Маг", data = obj("""{"prereq":{"spellcasting":true}}"""))
        val armor = CatalogueItem(8, 7, "Защита", data = obj("""{"prereq":{"armor_prof":[1]}}"""))
        val base =
            sheet(
                """{"spells":{"schema_version":2,"tabs":[],"grants":[]},"abilities_feats":[{"id":7,"requirements_met":false},{"id":8}]}"""
            )
        val next = sync(base, mapOf(7L to cast, 8L to armor))
        assertTrue(
            next.values["abilities_feats"].arrayValue().none {
                "requirements_met" in it.objectValue()
            }
        )
    }
}
