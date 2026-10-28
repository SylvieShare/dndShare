package ru.dndshare.client.character

import java.time.Instant
import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

data class WeaponUseRule(val rule: JsonObject, val resource: ResourceControl?, val error: String?)

fun weaponUseState(sheet: CharacterSheet, uid: String): JsonObject =
    inventoryInstances(sheet)
        .firstOrNull { it.first.text("uid") == uid }
        ?.first
        ?.get("params")
        .objectValue()["magic"]
        .objectValue()["weapon_use"]
        .objectValue()

fun weaponUseRules(
    sheet: CharacterSheet,
    uid: String,
    items: Map<Long, CatalogueItem>,
): List<WeaponUseRule> {
    val (entry, equipped) =
        inventoryInstances(sheet).firstOrNull { it.first.text("uid") == uid } ?: return emptyList()
    val item =
        items[(entry["magic_item_id"] ?: entry["item_id"]).referenceId()] ?: return emptyList()
    if (!magicActive(item, entry, equipped, sheet)) return emptyList()
    val resources = resourceControls(sheet, items)
    return item.data["weapon_uses"].arrayValue().map { raw ->
        val rule = raw.objectValue()
        val key =
            "abilities:magic_items:$uid" +
                rule.text("resource_key").takeIf(String::isNotBlank)?.let { ":$it" }.orEmpty()
        val resource = resources.firstOrNull { it.key == key }
        val cost = rule["resource_cost"].number(-1)
        val error =
            when {
                rule.text("key").isBlank() || rule.text("title").isBlank() ->
                    "Не задано название применения."
                rule.text("attack_mode") !in setOf("thrown", "melee", "ranged") ->
                    "Не задан способ атаки."
                cost !in 0..100 -> "Некорректная стоимость применения."
                rule["steps"].arrayValue().isEmpty() -> "Не заданы шаги применения."
                weaponUseState(sheet, uid).text("status") == "active" ->
                    "Завершите текущее применение."
                cost > 0 && (resource == null || resource.value < cost) ->
                    "Недостаточно ресурса для применения."
                else -> null
            }
        WeaponUseRule(rule, resource, error)
    }
}

data class WeaponUsePlan(
    val event: JsonObject,
    val patches: List<SheetPatch>,
    val resource: ResourceControl?,
    val cost: Int,
)

fun startWeaponUse(
    sheet: CharacterSheet,
    uid: String,
    key: String,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): WeaponUsePlan {
    val choice =
        weaponUseRules(sheet, uid, items).firstOrNull { it.rule.text("key") == key }
            ?: error("Применение недоступно.")
    require(choice.error == null) { choice.error.orEmpty() }
    val rule = choice.rule
    val entry = inventoryInstances(sheet).first { it.first.text("uid") == uid }.first
    val weapon =
        weaponReadout(sheet, entry, items, metadata, rule.text("attack_mode") == "thrown")
            ?: error("Основа оружия недоступна.")
    fun snapshot(raw: JsonElement): JsonObject {
        val step = raw.objectValue()
        require(
            step.text("key").isNotBlank() &&
                step.text("title").isNotBlank() &&
                step.text("kind") in setOf("damage", "weapon_damage")
        ) {
            "Некорректный шаг применения."
        }
        val count = step["dice_count"].number()
        require(count in 1..100 && step.text("dice").matches(Regex("d(4|6|8|10|12|20|100)"))) {
            "Некорректные кости применения."
        }
        val type =
            metadata.suggests["12"].orEmpty().firstOrNull {
                it.id == step["damage_type"].referenceId()
            }
        fun expression(critical: Boolean): String {
            val base =
                if (step.text("kind") == "weapon_damage") weapon.expression(critical = critical)
                else ""
            val n =
                count * if (critical && step["double_on_critical"] != JsonPrimitive(false)) 2 else 1
            val extra =
                "${if(step.text("sign")=="-") "-" else ""}$n${step.text("dice")}" +
                    (type?.let { "{${it.value}|${it.color.orEmpty()}}" }.orEmpty())
            return listOf(base, extra)
                .filter(String::isNotBlank)
                .joinToString("+")
                .replace("+-", "-")
        }
        return JsonObject(
            step +
                buildJsonObject {
                    put("status", "pending")
                    put("expression", expression(false))
                    put("critical_expression", expression(step.text("kind") == "weapon_damage"))
                    if (step["area"] is JsonObject)
                        put(
                            "area",
                            JsonObject(
                                step["area"].objectValue() +
                                    ("length_ft" to (rule["range_ft"] ?: JsonPrimitive(0)))
                            ),
                        )
                }
        )
    }
    val steps = rule["steps"].arrayValue().map(::snapshot)
    require(steps.map { it.text("key") }.distinct().size == steps.size) {
        "Ключи шагов должны различаться."
    }
    val event = buildJsonObject {
        put("id", UUID.randomUUID().toString())
        put("key", key)
        put("title", rule.text("title"))
        put("status", "active")
        put("created_at", Instant.now().toString())
        put("attack_mode", rule.text("attack_mode"))
        put("range_ft", rule["range_ft"] ?: JsonPrimitive(0))
        put("resource_cost", rule["resource_cost"].number())
        choice.resource?.let { put("resource_title", it.title) }
        put("steps", JsonArray(steps))
    }
    val cost = rule["resource_cost"].number()
    val patches =
        if (cost > 0)
            resourceChangePatches(
                sheet,
                requireNotNull(choice.resource),
                choice.resource.value - cost,
                items,
            )
        else emptyList()
    return WeaponUsePlan(event, patches, choice.resource, cost)
}

fun weaponUsePatch(sheet: CharacterSheet, uid: String, event: JsonObject): SheetPatch =
    sheetFieldPatch(
        sheet,
        inventoryInstancePath(sheet, uid) + sheetPath("params", "magic", "weapon_use"),
        event,
    )

fun completeWeaponUseStep(
    event: JsonObject,
    key: String,
    result: SheetRollResult?,
    critical: Boolean,
): JsonObject {
    require(event.text("status") == "active") { "Применение уже завершено." }
    val steps = event["steps"].arrayValue()
    val step =
        steps.map { it.objectValue() }.firstOrNull { it.text("key") == key }
            ?: error("Шаг больше не существует.")
    require(step.text("status") == "pending") { "Шаг уже выполнен." }
    require(result != null || step.text("kind") == "weapon_damage") {
        "Пропустить можно только атаку оружием."
    }
    val changed =
        JsonObject(
            step +
                buildJsonObject {
                    put("status", if (result == null) "missed" else "rolled")
                    put("critical", step.text("kind") == "weapon_damage" && critical)
                    if (result != null) {
                        put(
                            "result",
                            diceEventData(SheetRollRequest("", "damage"), result)
                                .getValue("result"),
                        )
                        if (step["save"].objectValue()["half"] == JsonPrimitive(true))
                            put("half_result", result.total / 2)
                    }
                }
        )
    return JsonObject(
        event +
            ("steps" to
                JsonArray(steps.map { if (it.objectValue().text("key") == key) changed else it }))
    )
}
