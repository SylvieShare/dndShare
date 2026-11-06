package ru.dndshare.client.mechanics

import kotlinx.serialization.json.*
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import kotlin.test.assertEquals
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

@RunWith(Parameterized::class)
class DerivedRulesTest(private val name: String, private val row: JsonObject) {
    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun scenarios(): List<Array<Any>> {
            return listOf("derived-rules", "feature-links").flatMap { file ->
                val raw = DerivedRulesTest::class.java.getResource("/game-mechanics/$file.json")!!.readText()
                WireJson.parseToJsonElement(raw).jsonArray.map {
                    arrayOf<Any>(it.jsonObject.text("name"), it.jsonObject)
                }
            }
        }
    }

    @Test
    fun sheetResults() {
        val items = row["items"].arrayValue().map { WireJson.decodeFromJsonElement<CatalogueItem>(it) }
        val sheet = CharacterSheet("DND5", 1, buildJsonObject { put("values", row.getValue("values")) }, 1)
        val derived = DndDerivedValues(sheet, items.associateBy { it.id })
        for (raw in row["checks"].arrayValue()) {
            val check = raw.jsonObject
            val kind = check.text("kind")
            val at = check["at"].objectValue()
            val context = RuleContext(
                kind = at.text("kind"), ability = at["abilitySuggestId"].referenceId(),
                skill = at["skillId"].referenceId(), target = at["targetId"],
                proficient = at["proficient"] == JsonPrimitive(true),
                weaponAttack = at["weaponAttack"] == JsonPrimitive(true), weaponKind = at.text("weaponKind"),
                improvised = at["improvisedWeapon"] == JsonPrimitive(true),
            )
            val actual: JsonElement = when (check.text("op")) {
                "weaponExpression" -> {
                    val entry = sheet.values["weapon"].arrayValue().single().jsonObject
                    val weapon = requireNotNull(weaponReadout(sheet, entry, derived.items, derived.metadata))
                    JsonPrimitive(weapon.expression(critical = at["critical"] == JsonPrimitive(true)))
                }
                "spell" -> derived.spellModifiers(at.getValue("spellId").jsonPrimitive.long).let {
                    buildJsonObject { put("range", it.range); put("damageBonus", it.damageBonus) }
                }
                "defenses" -> JsonArray(sheetDefenses(sheet, derived.items).map { it.text("kind") + ":" + it.text("damage_type") }.sorted().map(::JsonPrimitive))
                "hp" -> JsonPrimitive(derived.hpMaximum())
                "notes" -> JsonArray(ownedFeatureRules(sheet, derived.items, "passive_effects").map { it.rule.getValue("title") }.toList())
                "criticalDice" -> JsonPrimitive(criticalWeaponDiceRules(sheet, derived.items, "", at["melee"] == JsonPrimitive(true)).sumOf { it["extra_weapon_dice"].number() })
                "weaponDice" -> JsonArray(matchingWeaponDamageRules(sheet, derived.items, "", at["melee"] == JsonPrimitive(true),
                    at["ranged"] == JsonPrimitive(true), at["finesse"] == JsonPrimitive(true)).map { it.getValue("dice_count") })
                "adjust" -> {
                    val roll = prepareD20Roll(SheetRollRequest("Проверка", at.text("kind"), proficiencyRank = at["rank"].number()), derived)
                    JsonArray(listOfNotNull(roll.minimumRule?.get("value")))
                }
                "armor" -> JsonPrimitive(derived.armor.total)
                "speed" -> JsonPrimitive(derived.speed())
                "score" -> JsonPrimitive(derived.score(kind))
                "bonus" -> JsonPrimitive(derived.bonus(kind, context))
                "rank" -> JsonPrimitive(derived.rank(kind, context))
                "grants" -> JsonArray(derived.grantedTargets(kind).map(::JsonPrimitive))
                "modes" -> JsonArray(derived.rules(kind, context).map { it.rule.getValue("mode") })
                "formulas" -> JsonArray(derived.rules(kind, context).map { it.rule.getValue("formula") })
                "active" -> JsonPrimitive(derived.rules(kind, context).isNotEmpty())
                "threshold" -> JsonPrimitive(derived.criticalThreshold(context))
                else -> error("Unknown check: $check")
            }
            assertEquals(check["expect"], actual, "$name · $check")
        }
    }
}
