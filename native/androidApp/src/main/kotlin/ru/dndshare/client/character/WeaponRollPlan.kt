package ru.dndshare.client.character

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

@Serializable
data class WeaponRollOptions(
    val actionKeys: List<String> = emptyList(),
    val amounts: Map<String, Int> = emptyMap(),
    val critical: Boolean = false,
    val twoHanded: Boolean = false,
    val bonusAction: Boolean = false,
    val mode: String = "auto",
    val excludedBonuses: List<String> = emptyList(),
)

data class WeaponResourceCost(val resource: ResourceControl, val amount: Int)

data class WeaponDamagePlan(
    val request: SheetRollRequest,
    val patches: List<SheetPatch>,
    val costs: List<WeaponResourceCost>,
)

fun selectedWeaponDamageRules(actions: List<JsonObject>, keys: List<String>): List<JsonObject> {
    val selected = keys.toSet()
    val byKey = actions.associateBy { it.text("key") }
    fun enabled(key: String, visiting: Set<String>): Boolean {
        if (key !in selected || key in visiting) return false
        val rule = byKey[key] ?: return false
        val parent = rule.text("requires_damage_key")
        return parent.isBlank() || enabled(parent, visiting + key)
    }
    return actions.filter { enabled(it.text("key"), emptySet()) }
}

fun weaponDamageActions(
    sheet: CharacterSheet,
    entry: JsonObject,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
    improvised: Boolean = false,
): List<JsonObject> {
    val weapon = weaponReadout(sheet, entry, items, metadata) ?: return emptyList()
    val ranged = weapon.item.data["is_long_range"] == JsonPrimitive(true)
    val finesse =
        weapon.properties.any { it.contains("finesse", true) || it.contains("фехтовал", true) }
    val actions =
        matchingWeaponDamageRules(
            sheet,
            items,
            entry.text("uid"),
            !improvised && !ranged,
            !improvised && ranged,
            !improvised && finesse,
        )
    val natural = naturalThrownWeapon(weapon.item, weapon.properties)
    val hint =
        if (natural) "Метание с характеристикой оружия · ${weapon.range.ifBlank { "20/60" }} фт."
        else
            "Импровизированное метание: Ловкость, без бонуса владения · 20/60 фт. Тип урона уточните у мастера."
    if (actions.any { it.text("attack_mode") == "thrown" })
        return actions.map {
            if (it.text("attack_mode") == "thrown")
                JsonObject(
                    it +
                        mapOf(
                            "label" to JsonPrimitive("Метнуть"),
                            "attack_condition" to JsonPrimitive(hint),
                        )
                )
            else it
        }
    return listOf(
        buildJsonObject {
            put("key", "weapon:throw")
            put("label", "Метнуть")
            put("attack_mode", "thrown")
            put("condition", hint)
        }
    ) + actions
}

fun naturalThrownWeapon(item: CatalogueItem, labels: List<String>): Boolean =
    item.data["tags"].arrayValue().any { it.referenceId() == 6L } ||
        labels.any { it.contains("метатель", true) || it.contains("thrown", true) }

fun twoWeaponAbilityModifier(
    sheet: CharacterSheet,
    weapon: WeaponReadout,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
    thrown: Boolean,
): Boolean? {
    if (
        weapon.entry["params"].objectValue()["creation"].objectValue()["expired"] ==
            JsonPrimitive(true)
    )
        return null
    if (
        weapon.properties.any {
            Regex("двуруч|two.hand", RegexOption.IGNORE_CASE).containsMatchIn(it)
        }
    )
        return null
    if (thrown && !naturalThrownWeapon(weapon.item, weapon.properties)) return null
    val ranged = weapon.item.data["is_long_range"] == JsonPrimitive(true)
    if (sheet.sourceVersion != "2024" && ranged) return null
    val context =
        RuleContext(
            kind = "attack",
            target = weapon.entry["uid"],
            weaponAttack = true,
            weaponKind = if (thrown || ranged) "ranged" else "melee",
        )
    val derived = DndDerivedValues(sheet, items, metadata)
    val light =
        weapon.properties.any {
            Regex("л[её]гк|light", RegexOption.IGNORE_CASE).containsMatchIn(it)
        }
    if (!light && (ranged || derived.rules("two_weapon_non_light", context).isEmpty())) return null
    return derived.rules("two_weapon_damage_modifier", context).isNotEmpty()
}

fun weaponDamagePlan(
    sheet: CharacterSheet,
    uid: String,
    options: WeaponRollOptions,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): WeaponDamagePlan {
    val selections = weaponTargetSelectionPatches(sheet, uid, options, items, metadata)
    val projected = sheet.copy(data = applySheetPatches(sheet.data, selections))
    val plan = selectedWeaponDamagePlan(projected, uid, options, items, metadata)
    return plan.copy(patches = selections + plan.patches)
}

private fun selectedWeaponDamagePlan(
    sheet: CharacterSheet,
    uid: String,
    options: WeaponRollOptions,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): WeaponDamagePlan {
    val entry =
        inventoryInstances(sheet).firstOrNull { it.first.text("uid") == uid }?.first
            ?: error("Оружие больше не существует.")
    require(
        entry["params"].objectValue()["creation"].objectValue()["expired"] != JsonPrimitive(true)
    ) {
        "Срок существования предмета закончился."
    }
    val originalActions = weaponDamageActions(sheet, entry, items, metadata)
    val thrown =
        selectedWeaponDamageRules(originalActions, options.actionKeys).any {
            it.text("attack_mode") == "thrown"
        }
    val weapon =
        weaponReadout(sheet, entry, items, metadata, thrown)
            ?: error("Дождитесь загрузки оружия из справочника.")
    val improvised = thrown && !naturalThrownWeapon(weapon.item, weapon.properties)
    val actions = weaponDamageActions(sheet, entry, items, metadata, improvised)
    val selected = selectedWeaponDamageRules(actions, options.actionKeys)
    val offhand =
        if (options.bonusAction) twoWeaponAbilityModifier(sheet, weapon, items, metadata, thrown)
        else null
    require(!options.bonusAction || offhand != null) {
        "Бонусная атака этим оружием сейчас недоступна."
    }
    val twoHanded =
        options.twoHanded && !thrown && !options.bonusAction && weapon.twoHanded.isNotEmpty()
    val sourceParts = if (twoHanded) weapon.twoHanded else weapon.parts
    val terms =
        sourceParts
            .mapIndexed { index, part ->
                val baseCount = if (twoHanded) weapon.twoHandedPartCount else weapon.basePartCount
                val count =
                    if (options.critical && part.sides != null)
                        part.count * 2 +
                            (if (index == 0 && baseCount > 0) weapon.extraCriticalDice else 0)
                    else part.count
                SheetDamageTerm(
                    if (part.sides == null) count.toString() else "${count}d${part.sides}",
                    part.type,
                    part.color,
                )
            }
            .toMutableList()
    val modifier =
        weapon.damageBonus -
            (if (options.bonusAction && offhand == false) weapon.statModifier.coerceAtLeast(0)
            else 0)
    if (modifier != 0)
        terms.add(
            SheetDamageTerm(
                modifier.toString(),
                sourceParts.firstOrNull()?.type.orEmpty(),
                sourceParts.firstOrNull()?.color.orEmpty(),
            )
        )
    val resources = resourceControls(sheet, items)
    val grouped = linkedMapOf<String, WeaponResourceCost>()
    val labels = mutableListOf<String>()
    for (rule in selected) {
        val maximum = rule["resource_units_max"].number().takeIf { it in 2..20 }
        val units = if (maximum == null) 1 else options.amounts[rule.text("key")] ?: 0
        if (maximum != null) require(units in 1..maximum) { "Выберите число зарядов." }
        val count =
            rule["dice_count"].number() *
                units *
                (if (options.critical && rule["double_on_critical"] != JsonPrimitive(false)) 2
                else 1)
        val die = rule.text("dice")
        if (count > 0 && die.isNotBlank()) {
            val type =
                metadata.suggests["12"].orEmpty().firstOrNull {
                    it.id == rule["damage_type"].referenceId()
                }
            val sign = if (rule.text("sign") == "-") "-" else ""
            terms.add(
                SheetDamageTerm(
                    "$sign$count$die",
                    type?.value ?: sourceParts.firstOrNull()?.type.orEmpty(),
                    type?.color.orEmpty(),
                )
            )
        }
        if (
            rule["uses_resource"] == JsonPrimitive(true) || rule.text("resource_key").isNotBlank()
        ) {
            val owner = rule["resource_owner"].objectValue()
            val prefix = "abilities:${owner.text("valueId")}:${owner.text("entryKey")}"
            val key =
                prefix +
                    rule.text("resource_key").takeIf(String::isNotBlank)?.let { ":$it" }.orEmpty()
            val resource =
                resources.firstOrNull { it.key == key }
                    ?: error(
                        "Ресурс «${rule.text("label").ifBlank {rule.text("source_label")}}» недоступен."
                    )
            val raw = rule["resource_cost"]
            val unitCost =
                if (raw == null || raw == JsonNull) 1
                else
                    raw.jsonPrimitive.content.toIntOrNull()
                        ?: error("Стоимость ресурса должна быть целым числом.")
            require(unitCost > 0) { "Стоимость ресурса должна быть положительной." }
            val cost = Math.multiplyExact(unitCost, units)
            val previous = grouped[key]?.amount ?: 0
            grouped[key] = WeaponResourceCost(resource, Math.addExact(previous, cost))
        }
        labels.add(rule.text("label").ifBlank { rule.text("source_label") })
    }
    val costs = grouped.values.toList()
    costs.forEach {
        require(it.amount <= it.resource.value) {
            "Недостаточно ресурса «${it.resource.title}»: нужно ${it.amount}, доступно ${it.resource.value}."
        }
    }
    var current = sheet
    val patches = costs.flatMap { cost ->
        resourceChangePatches(current, cost.resource, cost.resource.value - cost.amount, items)
            .also {
                current = current.copy(data = applySheetPatches(current.data, it))
            }
    }
    val expression = terms.joinToString("+") { it.expression }.replace("+-", "-").ifBlank { "0" }
    val title =
        (if (options.critical) "Критический урон" else "Урон") +
            (if (options.bonusAction) " (бонусное действие)" else if (twoHanded) " (2р)" else "") +
            ": ${weapon.item.name}" +
            labels
                .filter(String::isNotBlank)
                .takeIf { it.isNotEmpty() }
                ?.joinToString(", ", " — ")
                .orEmpty()
    return WeaponDamagePlan(
        SheetRollRequest(
            title,
            "damage",
            formula = expression,
            targetUid = uid,
            sourceItemId = weapon.item.id.takeIf { it > 0 },
            sourceName = weapon.item.name,
            damageTerms = terms,
            weaponOptions =
                WireJson.parseToJsonElement(WireJson.encodeToString(options)).jsonObject,
            minimumTotal = 0,
        ),
        patches,
        costs,
    )
}
