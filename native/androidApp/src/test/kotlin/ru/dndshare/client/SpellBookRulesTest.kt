package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class SpellBookRulesTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    private val characterClass =
        CatalogueItem(
            11,
            9,
            "Маг",
            data =
                obj(
                    """{"caster_progression":"full","spellcasting":{"ability":4,"list_class":11,"selection_mode":"known","known_progression":[{"level":1,"cantrips":1,"spells":2},{"level":3,"cantrips":2,"spells":3}],"prepared_progression":[{"level":3,"count":2}],"allowed_schools":[1],"unrestricted_progression":[{"level":1,"count":1}]}}"""
                ),
        )

    private fun spell(id: Long, level: Int, school: Int = 1, classId: Int = 11) =
        CatalogueItem(
            id,
            5,
            "Заклинание $id",
            data = obj("""{"lvl":$level,"schoolId":$school,"classes":[$classId]}"""),
        )

    private val items =
        listOf(
                characterClass,
                spell(100, 1, 2),
                spell(101, 0),
                spell(102, 1),
                spell(103, 1),
                spell(104, 1),
                spell(105, 1, 2),
                spell(106, 3),
                spell(107, 1, 1, 12),
            )
            .associateBy { it.id }
    private val sheet =
        CharacterSheet(
            "DND5",
            1,
            obj(
                """{"values":{"lvl":{"level":3},"classes":[{"id":11,"level":3}],"spells":{"tabs":[{"key":"book","class_item_id":11,"mode":"prepared","spells":[{"key":"first","id":100,"prepared":true},{"key":"cantrip","id":101},{"key":"second","id":102,"prepared":true},{"key":"third","id":104}]}],"grants":[{"key":"grant","id":103,"tab_key":"book","counts_as_known":true}],"slot_pools":{"long_rest":[{"level":1,"total":4,"used":1}],"short_rest":[{"level":2,"total":2,"used":0}]}}}}"""
            ),
            1,
        )

    @Test
    fun bookRulesRespectClassCircleSchoolAndGrantedKnownCounts() {
        val tab = sheet.values["spells"].objectValue()["tabs"].arrayValue().single().objectValue()
        val rules = spellBookRules(sheet, tab, items)!!
        assertEquals(2, rules.maximumCircle)
        assertEquals(2, rules.preparedLimit)
        assertTrue(spellBookEligibility(sheet, tab, items.getValue(105), items).size >= 2)
        assertTrue(
            spellBookEligibility(sheet, tab, items.getValue(106), items).any { "Круг" in it }
        )
        assertTrue(
            spellBookEligibility(sheet, tab, items.getValue(107), items).any { "список" in it }
        )
        assertTrue(
            spellBookEligibility(sheet, tab, items.getValue(101), items, "cantrip").isEmpty()
        )
    }

    @Test
    fun preparingRequiresRoomButRemovingPreparationAlwaysRemainsPossible() {
        assertFails { spellPreparationPatch(sheet, "third", true, items) }
        assertFails { spellPreparationPatch(sheet, "cantrip", true, items) }
        var next =
            sheet.copy(
                data =
                    applySheetPatches(
                        sheet.data,
                        listOf(spellPreparationPatch(sheet, "first", false, items)),
                    )
            )
        next =
            next.copy(
                data =
                    applySheetPatches(
                        next.data,
                        listOf(spellPreparationPatch(next, "third", true, items)),
                    )
            )
        assertEquals(
            2,
            preparedSpellCount(
                next.values["spells"]
                    .objectValue()["tabs"]
                    .arrayValue()
                    .single()
                    .objectValue()["spells"]
                    .arrayValue(),
                items,
            ),
        )
        assertEquals(
            sheet.values["spells"].objectValue()["grants"],
            next.values["spells"].objectValue()["grants"],
        )
    }

    @Test
    fun slotEditsStayWithinTheChosenPoolAndItsBounds() {
        val next =
            applySheetPatches(sheet.data, listOf(spellSlotUsedPatch(sheet, "long_rest", 1, 3)))[
                    "values"]
                .objectValue()["spells"]
                .objectValue()["slot_pools"]
                .objectValue()
        assertEquals(3, next["long_rest"].arrayValue().single().objectValue()["used"].number())
        assertEquals(
            sheet.values["spells"].objectValue()["slot_pools"].objectValue()["short_rest"],
            next["short_rest"],
        )
        assertFails { spellSlotUsedPatch(sheet, "long_rest", 1, 5) }
        assertFails { spellSlotUsedPatch(sheet, "long_rest", 2, 0) }
    }
}
