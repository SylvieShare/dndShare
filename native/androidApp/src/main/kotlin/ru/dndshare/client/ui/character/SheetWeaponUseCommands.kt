package ru.dndshare.client.ui.character

import java.time.Instant
import java.util.UUID
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CachedSheetSection
import ru.dndshare.client.model.*

internal suspend fun performWeaponUse(
    uuid: String,
    uid: String,
    operation: String,
    input: JsonObject,
    sheet: CharacterSheet,
    content: SheetContentState,
    session: String?,
    sheets: CharacterSheetRepository,
    commands: CharacterCommandQueue?,
) {
    if (operation == "weapon-use-start") {
        performWeaponUseStart(uuid, uid, input, sheet, content, session, sheets, commands)
        return
    }
    val items = content.items
    val old = weaponUseState(sheet, uid)
    if (operation != "weapon-use-start")
        require(input.text("id") == old.text("id") && old.text("status") == "active") {
            "Применение изменилось. Откройте его заново."
        }
    val working = sheet
    val patches = mutableListOf<SheetPatch>()
    var record: SheetRollRecord? = null
    var eventData: JsonObject? = null
    var eventType = "feature_state"
    var action: String
    val event: JsonObject =
        when (operation) {
            "weapon-use-step",
            "weapon-use-miss" -> {
                val step =
                    old["steps"]
                        .arrayValue()
                        .map { it.objectValue() }
                        .firstOrNull { it.text("key") == input.text("step") }
                        ?: error("Шаг не найден.")
                require(step.text("status") == "pending") { "Шаг уже выполнен." }
                val critical =
                    step.text("kind") == "weapon_damage" && input["critical"] == JsonPrimitive(true)
                val request =
                    SheetRollRequest(
                        "${old.text("title")}: ${step.text("title")}",
                        "damage",
                        formula = step.text(if (critical) "critical_expression" else "expression"),
                        minimumTotal = 0,
                        targetUid = uid,
                        sourceItemId =
                            inventoryInstances(sheet)
                                .firstOrNull { it.first.text("uid") == uid }
                                ?.first
                                ?.let { (it["magic_item_id"] ?: it["item_id"]).referenceId() },
                        sourceName =
                            inventoryInstances(sheet)
                                .firstOrNull { it.first.text("uid") == uid }
                                ?.first
                                ?.let {
                                    items[(it["magic_item_id"] ?: it["item_id"]).referenceId()]
                                        ?.name
                                } ?: old.text("title"),
                        repeatable = false,
                    )
                val result =
                    if (operation == "weapon-use-miss") null
                    else rollSheet(request, DndDerivedValues(sheet, items, content.metadata))
                action = request.title + if (result == null) " — промах" else ""
                if (result != null) {
                    record =
                        SheetRollRecord(
                            UUID.randomUUID().toString(),
                            request,
                            result,
                            completedAt = System.currentTimeMillis(),
                            sessionUuid = session,
                        )
                    eventType = "dice_roll"
                    eventData =
                        JsonObject(
                            diceEventData(request, result) +
                                buildJsonObject {
                                    put("weaponUseId", old.text("id"))
                                    put("stepKey", step.text("key"))
                                    if (step["save"] is JsonObject)
                                        put(
                                            "savingThrow",
                                            JsonObject(
                                                step["save"].objectValue() +
                                                    mapOf(
                                                        "onSuccess" to
                                                            JsonPrimitive(
                                                                if (
                                                                    step["save"]
                                                                        .objectValue()["half"] ==
                                                                        JsonPrimitive(true)
                                                                )
                                                                    "half"
                                                                else "none"
                                                            ),
                                                        "results" to JsonArray(emptyList()),
                                                    )
                                            ),
                                        )
                                }
                        )
                }
                completeWeaponUseStep(old, step.text("key"), result, critical)
            }
            "weapon-use-finish" -> {
                action = "${old.text("title")}: применение завершено"
                JsonObject(
                    old +
                        mapOf(
                            "status" to JsonPrimitive("completed"),
                            "completed_at" to JsonPrimitive(Instant.now().toString()),
                        )
                )
            }
            else -> error("Неизвестное действие оружия.")
        }
    patches.add(weaponUsePatch(working, uid, event))
    val data =
        JsonObject(
            (eventData ?: JsonObject(emptyMap())) +
                mapOf(
                    "instanceUid" to JsonPrimitive(uid),
                    "weaponUseId" to JsonPrimitive(event.text("id")),
                )
        )
    val metadata =
        if (session != null) sessionMetadata(session, eventType, action, data)
        else listOf(buildJsonObject { put("roll", data) })
    sheets.enqueue(
        uuid,
        patches,
        sheet.data,
        metadata = metadata,
        checkpoint =
            record?.let {
                CachedSheetSection(uuid, SheetRollRecord.SECTION, WireJson.encodeToString(it))
            },
    )
}
