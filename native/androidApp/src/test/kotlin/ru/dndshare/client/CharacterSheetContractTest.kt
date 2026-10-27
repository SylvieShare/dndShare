package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class CharacterSheetContractTest {
    private fun document(text: String) = WireJson.parseToJsonElement(text).jsonObject
    private fun sheet(text: String) = CharacterSheet("DND5", 1, document(text), 1, sourceVersion = "2014")
    private val base = document("""{"values":{"hp":{"current":10,"max":{"base":12,"bonuses":[]}},"STR":{"value":{"base":9,"bonuses":[]}}}}""")

    @Test fun independentRemoteEditsArePreserved() {
        val edit = createSheetEdit(base, listOf(SheetPatch(path = sheetPath("values", "hp", "current"), value = JsonPrimitive(7))))
        val remote = applySheetPatches(base, listOf(SheetPatch(path = sheetPath("values", "STR", "value", "base"), value = JsonPrimitive(14))))
        val rebased = assertNotNull(rebaseSheetEdit(edit, remote))
        val result = applySheetPatches(remote, rebased.patches)
        assertEquals(JsonPrimitive(7), sheetValue(result, sheetPath("values", "hp", "current")))
        assertEquals(JsonPrimitive(14), sheetValue(result, sheetPath("values", "STR", "value", "base")))
        assertEquals(JsonPrimitive(10), sheetValue(base, sheetPath("values", "hp", "current")))
    }

    @Test fun conflictBlocksAnOverwriteAndMatchingResultIsAlreadyApplied() {
        val edit = createSheetEdit(base, listOf(SheetPatch(path = sheetPath("values", "hp", "current"), value = JsonPrimitive(7))))
        val remote = applySheetPatches(base, listOf(SheetPatch(path = sheetPath("values", "hp", "current"), value = JsonPrimitive(4))))
        assertNull(rebaseSheetEdit(edit, remote))
        val already = applySheetPatches(base, edit.patches)
        assertTrue(assertNotNull(rebaseSheetEdit(edit, already)).patches.isEmpty())
    }

    @Test fun missingAndNullHaveDifferentPreconditions() {
        val edit = createSheetEdit(base, listOf(SheetPatch(path = sheetPath("values", "hp", "temp"), value = JsonPrimitive(3))))
        val remote = applySheetPatches(base, listOf(SheetPatch(path = sheetPath("values", "hp", "temp"), value = JsonNull)))
        assertNull(rebaseSheetEdit(edit, remote))
    }

    @Test fun keyedCollectionsDoNotDependOnArrayIndices() {
        val original = document("""{"rows":[{"uid":"a","n":1},{"uid":"b","n":2}]}""")
        val selector = buildJsonObject { put("idField", "uid"); put("id", "c") }
        val inserted = applySheetPatches(original, listOf(SheetPatch("insert", listOf(JsonPrimitive("rows"), selector),
            buildJsonObject { put("uid", "c"); put("n", 3) }, beforeId = JsonPrimitive("b"))))
        val reordered = applySheetPatches(inserted, listOf(SheetPatch("order", sheetPath("rows"),
            JsonArray(listOf("b", "c", "a").map(::JsonPrimitive)), idField = "uid")))
        assertEquals(listOf("b", "c", "a"), reordered["rows"]!!.jsonArray.map { it.jsonObject.getValue("uid").jsonPrimitive.content })
    }

    @Test fun manualHpMaximumKeepsBonusesAndRecordsItsHistory() {
        val character = sheet("""{"values":{"hp":{"current":8,"temp":0,"max":{"base":10,"bonuses":[{"name":"Ручной","value":2}]}}}}""")
        val next = character.copy(data = applySheetPatches(character.data, character.hpPatches(8, 0, 20)))
        assertEquals(22, next.hpMaximum())
        assertEquals(8, next.values["hp"].objectValue()["current"].number())
        val history = next.values["hp"].objectValue()["history"]!!.jsonArray
        assertEquals(listOf("untracked", "manual"), history.map { it.jsonObject.getValue("kind").jsonPrimitive.content })
        assertEquals(20, history.sumOf { it.jsonObject.getValue("gain").jsonPrimitive.int })
    }

    @Test fun featureHpAndStatusProjectionDoNotChangeStoredBases() {
        val character = sheet("""{"values":{"lvl":{"level":3},"hp":{"max":{"base":10}},"STR":{"value":{"base":8,"bonuses":[]}},"abilities_feats":[{"id":501}],"states":[{"uid":"buff","effect_id":601,"params":{"strength":20}}]}}""")
        val feat = CatalogueItem(501, 7, "Крепкий", data = document("""{"hp_bonuses":[{"level":1,"per_level":2}]}"""))
        val buff = CatalogueItem(601, 15, "Сила", data = document("""{"derived_effects":[{"kind":"ability_minimum","ability_ids":[1],"value_parameter":"strength"}]}"""))
        val calculated = DndDerivedValues(character, mapOf(501L to feat, 601L to buff))
        assertEquals(16, calculated.hpMaximum())
        assertEquals(20, calculated.score("STR"))
        assertEquals(8, character.statScore("STR"))
        assertEquals(-1, abilityModifier(9))
    }

    @Test fun armorAndShieldCompeteInsteadOfStackingDuplicates() {
        val character = sheet("""{"values":{"DEX":{"value":{"base":14}},"items":{"equipped":[{"uid":"mail","item_id":101},{"uid":"shield","item_id":102},{"uid":"shield2","item_id":102}]}}}""")
        val mail = CatalogueItem(101, 12, "Кольчуга", data = document("""{"armor":{"ac":16,"use_dex":false}}"""))
        val shield = CatalogueItem(102, 12, "Щит", data = document("""{"armor":{"shield":true,"shield_bonus":2}}"""))
        assertEquals(18, DndDerivedValues(character, mapOf(101L to mail, 102L to shield)).armor.total)
    }

    @Test fun addedStatusKeepsDurationAndMergesWithAnotherIndependentStatus() {
        val character = sheet("""{"values":{"states":[]}}""")
        val effect = CatalogueItem(70, 15, "Эффект", data = document("""{"duration":{"unit":"minute","value":1},"level":2}"""))
        val patches = selectedStatusPatches(character, listOf(70), mapOf(70L to effect))
        assertEquals("insert", patches.single().op)
        val existing = document("""{"values":{"states":[{"uid":"remote","effect_id":99}]}}""")
        val edit = createSheetEdit(character.data, patches)
        val merged = applySheetPatches(existing, assertNotNull(rebaseSheetEdit(edit, existing)).patches)
        assertEquals(2, merged["values"]!!.jsonObject["states"]!!.jsonArray.size)
        assertEquals(effect.data["duration"], patches.single().value.jsonObject["duration"])
        assertEquals(JsonPrimitive(2), patches.single().value.jsonObject["params"]!!.jsonObject["level"])
    }
}
