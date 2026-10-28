package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.creation.creationStats
import ru.dndshare.client.model.*

data class WeaponDamagePart(
    val count: Int,
    val sides: Int?,
    val type: String,
    val typeId: Long? = null,
    val color: String = "",
) {
    val formula
        get() = if (sides == null) count.toString() else "${count}d$sides"
}

data class WeaponReadout(
    val entry: JsonObject,
    val item: CatalogueItem,
    val ability: Long,
    val proficient: Boolean,
    val attack: Int,
    val statModifier: Int,
    val damageBonus: Int,
    val parts: List<WeaponDamagePart>,
    val twoHanded: List<WeaponDamagePart>,
    val properties: List<String>,
    val range: String,
    val criticalThreshold: Int,
    val extraCriticalDice: Int,
    val basePartCount: Int = parts.size,
    val twoHandedPartCount: Int = twoHanded.size,
) {
    fun expression(
        versatile: Boolean = false,
        critical: Boolean = false,
        offhand: Boolean = false,
        addOffhandAbility: Boolean = false,
    ): String {
        val useVersatile = versatile && twoHanded.isNotEmpty()
        val source = (if (useVersatile) twoHanded else parts)
        val terms = source.mapIndexed { index, part ->
            val count =
                if (critical && part.sides != null)
                    part.count * 2 +
                        (if (
                            index == 0 &&
                                (if (useVersatile) twoHandedPartCount else basePartCount) > 0
                        )
                            extraCriticalDice
                        else 0)
                else part.count
            if (part.sides == null) count.toString() else "${count}d${part.sides}"
        }
        val modifier =
            damageBonus - (if (offhand && !addOffhandAbility) statModifier.coerceAtLeast(0) else 0)
        return (terms +
                modifier
                    .takeIf { it != 0 }
                    ?.let { if (it > 0) "+$it" else it.toString() }
                    .orEmpty())
            .filter(String::isNotBlank)
            .joinToString("+")
            .replace("++", "+")
            .replace("+-", "-")
            .ifBlank { "0" }
    }
}

fun resolveWeapon(entry: JsonObject, items: Map<Long, CatalogueItem>): CatalogueItem? {
    if (entry["item_id"].referenceId() == null && entry["magic_item_id"].referenceId() == null)
        return CatalogueItem(
            0,
            1,
            entry["override"].objectValue().text("name").ifBlank { "Авторское оружие" },
            data = entry["override"].objectValue(),
        )
    val initial = items[entry["item_id"].referenceId()] ?: return null
    val magicId = entry["magic_item_id"].referenceId() ?: initial.takeIf { it.typeId == 19L }?.id
    val lost = entry["params"].objectValue()["magic"].objectValue()["lost"] == JsonPrimitive(true)
    val source = if (lost) null else items[magicId]
    val base =
        if (initial.typeId == 19L)
            items[
                (initial.data["weapon"].objectValue()["base_item_id"]
                        ?: entry["params"].objectValue()["weapon_base_item_id"])
                    .referenceId()]
        else initial
    if (base?.typeId != 1L) return null
    if (magicId != null && !lost && source == null) return null
    val identity = source ?: base
    val data = base.data.toMutableMap()
    if (source != null) {
        val rule = source.data["weapon"].objectValue()
        val physical =
            listOf(
                    "attacks",
                    "universe_attacks",
                    "tags",
                    "is_military",
                    "is_long_range",
                    "range_min",
                    "range_max",
                    "required_weapon_proficiencies",
                )
                .associateWith { base.data[it] ?: JsonNull }
                .toMutableMap()
        rule["damage_type"]
            ?.takeUnless { it == JsonNull }
            ?.let { type ->
                for (key in listOf("attacks", "universe_attacks")) physical[key] =
                    JsonArray(
                        physical[key].arrayValue().map {
                            JsonObject(it.objectValue() + ("type" to type))
                        }
                    )
            }
        physical["tags"] =
            JsonArray((physical["tags"].arrayValue() + rule["extra_tags"].arrayValue()).distinct())
        physical["required_weapon_proficiencies"] =
            JsonArray(
                (physical["required_weapon_proficiencies"].arrayValue() +
                        rule["extra_proficiencies"].arrayValue())
                    .distinct()
            )
        for (key in listOf("range_min", "range_max")) rule[key]
            ?.takeUnless { it == JsonNull }
            ?.let { physical[key] = it }
        data.putAll(source.data)
        data.putAll(physical)
        data["subtype"] = JsonPrimitive(base.name)
    }
    val override = entry["override"].objectValue()
    data.putAll(override)
    return identity.copy(
        name = override.text("name").ifBlank { identity.name },
        data = JsonObject(data),
    )
}

fun weaponReadout(
    sheet: CharacterSheet,
    entry: JsonObject,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
    thrown: Boolean = false,
): WeaponReadout? {
    val item = resolveWeapon(entry, items) ?: return null
    val mechanics = DndDerivedValues(sheet, items, metadata)
    val tags = item.data["tags"].arrayValue()
    val labels = tags.map { raw ->
        if (raw is JsonObject) raw.label()
        else
            metadata.suggests["14"].orEmpty().firstOrNull { it.id == raw.referenceId() }?.value
                ?: raw.jsonPrimitive.content
    }
    val naturalThrown =
        tags.any { it.referenceId() == 6L } ||
            labels.any { it.contains("метатель", true) || it.contains("thrown", true) }
    val improvised = thrown && !naturalThrown
    val finesse = labels.any { it.contains("фехтовал", true) || it.contains("finesse", true) }
    val ability =
        if (improvised) 2L
        else
            entry["stat_suggest_id"].referenceId()?.takeIf { it in 1..6 }
                ?: when {
                    finesse ->
                        if (
                            abilityModifier(mechanics.score("DEX")) >
                                abilityModifier(mechanics.score("STR"))
                        )
                            2L
                        else 1L
                    item.data["is_long_range"] == JsonPrimitive(true) -> 2L
                    else -> 1L
                }
    val modifier = abilityModifier(mechanics.score(creationStats[(ability - 1).toInt()]))
    val proficient =
        !improvised &&
            (entry["proficient"] == JsonPrimitive(true) || weaponProficient(item, mechanics))
    val intrinsic =
        if (improvised || entry["magic_item_id"].referenceId() == null) 0
        else {
            val rule = item.data["weapon"].objectValue()
            val bonusItem =
                if (rule["bonus_without_attunement"] == JsonPrimitive(true))
                    item.copy(
                        data = JsonObject(item.data + ("attunement" to JsonPrimitive("none")))
                    )
                else item
            if (magicActive(bonusItem, entry, true, sheet))
                rule["magic_bonus"].number() - (weaponBonusTransfer(sheet, entry, item)?.value ?: 0)
            else 0
        }
    val magic =
        if (improvised) 0 else entry["params"].objectValue()["magic_bonus"].number() + intrinsic
    val context =
        RuleContext(
            kind = "attack",
            ability = ability,
            target = entry["uid"],
            weaponAttack = true,
            weaponKind =
                if (thrown || item.data["is_long_range"] == JsonPrimitive(true)) "ranged"
                else "melee",
            improvised = improvised,
        )
    val attack =
        modifier +
            magic +
            (if (proficient) sheet.proficiency() else 0) +
            mechanics.bonus("weapon_attack_bonus", context)
    val damageBonus = modifier + magic + mechanics.bonus("weapon_damage_bonus", context)
    fun parts(raw: JsonElement?) =
        raw.arrayValue().mapNotNull { value ->
            val row = value.objectValue()
            val id = row["dice_id"]?.jsonPrimitive?.content.orEmpty()
            val dice = metadata.suggests["1"].orEmpty().firstOrNull { it.id.toString() == id }
            val sides =
                (dice?.value ?: id).filter(Char::isDigit).toIntOrNull() ?: return@mapNotNull null
            val typeId = (row["type"] ?: row["type_suggest_id"]).referenceId()
            WeaponDamagePart(
                row["count"].number(1).coerceAtLeast(1),
                sides,
                metadata.suggests["12"].orEmpty().firstOrNull { it.id == typeId }?.value.orEmpty(),
                typeId,
                metadata.suggests["12"].orEmpty().firstOrNull { it.id == typeId }?.color.orEmpty(),
            )
        }
    val additional = if (improvised) emptyList() else parts(entry["add_attacks"])
    val base =
        if (improvised)
            listOf(
                parts(item.data["attacks"]).firstOrNull()?.let { it.copy(count = 1, sides = 4) }
                    ?: WeaponDamagePart(1, 4, "")
            )
        else parts(item.data["attacks"])
    val versatile = if (improvised) emptyList() else parts(item.data["universe_attacks"])
    val threshold =
        mechanics.rules("critical_threshold", context).minOfOrNull {
            it.rule["value"].number(20).coerceIn(2, 20)
        } ?: 20
    val extra =
        if (improvised) 0
        else extraCriticalWeaponDice(sheet, items, entry.text("uid"), context.weaponKind == "melee")
    val range =
        if (thrown && !naturalThrown) "20/60"
        else
            listOfNotNull(item.data["range_min"], item.data["range_max"])
                .filter { it != JsonNull }
                .joinToString("/") { it.jsonPrimitive.content }
    return WeaponReadout(
        entry,
        item,
        ability,
        proficient,
        attack,
        modifier,
        damageBonus,
        base + additional,
        if (versatile.isEmpty()) emptyList() else versatile + additional,
        labels,
        range,
        threshold,
        extra,
        base.size,
        versatile.size,
    )
}

private fun weaponProficient(item: CatalogueItem, derived: DndDerivedValues): Boolean {
    val required =
        item.data["required_weapon_proficiencies"].arrayValue().mapNotNull { it.referenceId() }
    val owned =
        derived.sheet.values["proficiencies"]
            .objectValue()["Оружие"]
            .arrayValue()
            .map { if (it is JsonObject) it.label() else it.jsonPrimitive.content }
            .map { it.trim().lowercase().replace('ё', 'е') }
    val allowed =
        derived.metadata.suggests["4"]
            .orEmpty()
            .filter { it.value.trim().lowercase().replace('ё', 'е') in owned }
            .map { it.id }
            .toSet()
    if (required.any { it in allowed }) return true
    val grants =
        derived.effects
            .filter { it.rule.text("kind") == "weapon_proficiency" }
            .flatMap { rule ->
                if (rule.rule["target_from_choice"] == JsonPrimitive(true)) {
                    val prefix =
                        rule.rule
                            .text("choice_value_prefix")
                            .takeIf(String::isNotBlank)
                            ?.plus(":")
                            .orEmpty()
                    rule.entry["choices"]
                        .objectValue()[rule.rule.text("choice_key")]
                        .arrayValue()
                        .map { it.jsonPrimitive.content }
                        .filter { prefix.isBlank() || it.startsWith(prefix) }
                        .mapNotNull { it.removePrefix(prefix).toLongOrNull() }
                } else rule.rule["target_ids"].arrayValue().mapNotNull { it.referenceId() }
            }
    return required.any { it in grants }
}
