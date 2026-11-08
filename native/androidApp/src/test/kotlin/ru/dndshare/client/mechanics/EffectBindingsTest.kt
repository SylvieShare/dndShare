package ru.dndshare.client.mechanics

import kotlinx.serialization.json.*
import kotlin.test.assertEquals
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class EffectBindingsTest {
    @Test
    fun appliedSpellParametersGiveTheSameWeaponBonusAndDamageAsWeb() {
        val raw = javaClass.getResource("/game-mechanics/effect-bindings.json")!!.readText()
        for (fixture in WireJson.parseToJsonElement(raw).jsonArray.map(JsonElement::jsonObject)) {
            val effect = WireJson.decodeFromJsonElement<CatalogueItem>(fixture.getValue("effect"))
            for (cast in fixture["casts"].arrayValue().map(JsonElement::jsonObject)) {
                val wanted = cast["want"].number()
                val values = buildJsonObject {
                    put("lvl", buildJsonObject { put("level", 1) })
                    put("INT", buildJsonObject { put("value", 6) })
                    put("states", buildJsonArray { add(buildJsonObject {
                        put("uid", "applied"); put("effect_id", effect.id)
                        put("params", buildJsonObject {
                            put(fixture["binding"].objectValue().text("key"), wanted)
                            put("weapon_uid", "sword")
                        })
                    }) })
                }
                val sheet = CharacterSheet("DND5", 1, buildJsonObject { put("values", values) }, 1)
                val items = mapOf(effect.id to effect)
                val derived = DndDerivedValues(sheet, items)
                val attack = derived.bonus("weapon_attack_bonus", RuleContext(target = JsonPrimitive("sword")))
                assertEquals(if (fixture["attack"] == JsonPrimitive(true)) wanted else 0, attack, fixture.text("name"))
                assertEquals(0, derived.bonus("weapon_attack_bonus", RuleContext(target = JsonPrimitive("other"))))
                val damage = matchingWeaponDamageRules(sheet, items, "sword", true, false, false)
                    .map { it["dice_count"].number().toString() + it.text("dice") }
                assertEquals(if (wanted > 0) listOf("$wanted${fixture.text("die")}") else emptyList(), damage)
                assertEquals(emptyList(), matchingWeaponDamageRules(sheet, items, "other", true, false, false))
            }
        }
    }
}
