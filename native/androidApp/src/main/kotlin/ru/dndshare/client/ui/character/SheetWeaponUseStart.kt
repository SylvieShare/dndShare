package ru.dndshare.client.ui.character

import java.util.UUID
import kotlin.random.Random
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CachedSheetSection
import ru.dndshare.client.model.*

internal suspend fun performWeaponUseStart(
    uuid: String,
    uid: String,
    input: JsonObject,
    sheet: CharacterSheet,
    content: SheetContentState,
    session: String?,
    sheets: CharacterSheetRepository,
    commands: CharacterCommandQueue?,
) {
    val items = content.items
    val plan = startWeaponUse(sheet, uid, input.text("key"), items, content.metadata)
    val entry = inventoryInstances(sheet).first { it.first.text("uid") == uid }.first
    val weapon =
        requireNotNull(
            weaponReadout(
                sheet,
                entry,
                items,
                content.metadata,
                plan.event.text("attack_mode") == "thrown",
            )
        )
    val display =
        SheetRollRequest(
            plan.event.text("title") + ": " + weapon.item.name,
            "attack",
            ability = weapon.ability,
            bonus = weapon.attack,
            manualMode = input.text("mode").ifBlank { "auto" },
            targetUid = uid,
            weaponAttack = true,
            weaponKind = if (plan.event.text("attack_mode") == "melee") "melee" else "ranged",
            sourceItemId = weapon.item.id.takeIf { it > 0 },
            sourceName = weapon.item.name,
            criticalThreshold = weapon.criticalThreshold,
            eventData =
                buildJsonObject {
                    put("instanceUid", uid)
                    put("weaponUseId", plan.event.text("id"))
                },
            repeatable = false,
        )
    val request =
        display.copy(
            eventData =
                JsonObject(
                    display.eventData +
                        buildJsonObject {
                            put("resourceSpent", plan.cost)
                            plan.resource?.let { resource ->
                                if (plan.cost > 0)
                                    put(
                                        "resourceChanges",
                                        buildJsonArray {
                                            add(
                                                buildJsonObject {
                                                    put("key", resource.key)
                                                    put("name", resource.title)
                                                    put("delta", -plan.cost)
                                                    put("remaining", resource.value - plan.cost)
                                                    put("total", resource.total)
                                                }
                                            )
                                        },
                                    )
                            }
                        }
                )
        )
    val derived = DndDerivedValues(sheet, items, content.metadata)
    val prepared = prepareD20Roll(request, derived)
    var working = sheet.copy(data = applySheetPatches(sheet.data, plan.patches))
    val ending = endingStatusPatches(working, items, "attack")
    val patches = plan.patches + ending
    working = sheet.copy(data = applySheetPatches(sheet.data, patches))
    val triggers = rollTriggerCandidates(working, items, display, true)
    val id = UUID.randomUUID().toString()
    if (session != null) {
        val before = patches.map { patch ->
            val previous = sheetValue(sheet.data, patch.path)
            SheetPrecondition(patch.path, previous != null, previous ?: JsonNull)
        }
        val intent = buildJsonObject {
            put("sessionUuid", session)
            put("prepared", WireJson.parseToJsonElement(WireJson.encodeToString(prepared)))
            put("patches", WireJson.parseToJsonElement(WireJson.encodeToString(patches)))
            put("before", WireJson.parseToJsonElement(WireJson.encodeToString(before)))
            put(
                "weaponUse",
                buildJsonObject {
                    put("uid", uid)
                    put("start", plan.event)
                    put(
                        "previous",
                        sheetValue(
                            sheet.data,
                            inventoryInstancePath(sheet, uid) +
                                sheetPath("params", "magic", "weapon_use"),
                        ) ?: JsonNull,
                    )
                },
            )
        }
        requireNotNull(commands)
            .send(
                "dice-roll",
                intent,
                presentation =
                    buildJsonObject {
                        put("id", id)
                        put(
                            "request",
                            WireJson.parseToJsonElement(WireJson.encodeToString(display)),
                        )
                        put(
                            "triggers",
                            WireJson.parseToJsonElement(WireJson.encodeToString(triggers)),
                        )
                    },
            )
        return
    }
    val result =
        resolvePreparedD20(
            prepared,
            List(if (prepared.mode == "normal") 1 else 2) { Random.nextInt(1, 21) },
        )
    val event =
        JsonObject(
            plan.event +
                mapOf(
                    "attack_result" to diceResultData(result),
                    "critical" to JsonPrimitive((result.selected ?: 0) >= weapon.criticalThreshold),
                )
        )
    val all = patches + weaponUsePatch(working, uid, event)
    val record =
        SheetRollRecord(
            id,
            display,
            result,
            prepared,
            triggers,
            completedAt = System.currentTimeMillis(),
            sessionUuid = null,
        )
    sheets.enqueue(
        uuid,
        all,
        sheet.data,
        metadata = listOf(buildJsonObject { put("roll", diceEventData(request, result)) }),
        checkpoint =
            CachedSheetSection(uuid, SheetRollRecord.SECTION, WireJson.encodeToString(record)),
    )
}
