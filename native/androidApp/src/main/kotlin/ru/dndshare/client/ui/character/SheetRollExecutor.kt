package ru.dndshare.client.ui.character

import java.util.UUID
import kotlin.random.Random
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*

/**
 * One owner for preparation, confirmed consumption, durable execution and the displayed receipt.
 */
internal class SheetRollExecutor(
    private val uuid: String,
    private val accountId: Long,
    private val sheets: CharacterSheetRepository,
    private val cache: CharacterSheetDao,
    private val commands: CharacterCommandQueue?,
    private val content: () -> SheetContentState,
    private val session: () -> String?,
    private val concentration: () -> JsonObject?,
) {
    suspend fun execute(
        request: SheetRollRequest,
        mode: String,
        rerollOf: SheetRollRecord? = null,
        triggerKey: String? = null,
        displayId: String = UUID.randomUUID().toString(),
    ): SheetRollRecord {
        val session = session()
        require(rerollOf == null || rerollOf.sessionUuid == session) {
            "Сессия этого броска изменилась. Выполните новую проверку."
        }
        val sheet = requireNotNull(sheets.local(uuid)).displayed
        val data = content()
        val owner = sheet.userId == accountId
        var current = request
        val costs = mutableListOf<SheetPatch>()
        if (rerollOf != null) {
            val trigger =
                revalidateRollTrigger(
                    sheet,
                    data.items,
                    rerollOf,
                    requireNotNull(triggerKey),
                    owner,
                )
            if (trigger.useKey.isNotBlank()) {
                val use =
                    confirmedItemUses(sheet, data.items, trigger.useUid).first {
                        it.key == trigger.useKey
                    }
                costs.addAll(
                    confirmItemUsePatches(sheet, data.items, trigger.useUid, trigger.useKey)
                )
                val resource = requireNotNull(use.resource)
                current =
                    current.copy(
                        eventData =
                            JsonObject(
                                current.eventData +
                                    buildJsonObject {
                                        put("resourceSpent", use.cost)
                                        put(
                                            "resourceChanges",
                                            buildJsonArray {
                                                add(
                                                    buildJsonObject {
                                                        put("key", resource.key)
                                                        put("name", resource.title)
                                                        put("delta", -use.cost)
                                                        put("remaining", resource.value - use.cost)
                                                        put("total", resource.total)
                                                    }
                                                )
                                            },
                                        )
                                    }
                            )
                    )
            }
        }
        val derived = DndDerivedValues(sheet, data.items, data.metadata)
        val prepared =
            if (current.formula != null) null
            else if (rerollOf != null)
                rerollPreparedD20(requireNotNull(rerollOf.prepared)).copy(request = current)
            else prepareD20Roll(current, derived, mode)
        val triggers =
            if (prepared == null || rerollOf != null) emptyList()
            else rollTriggerCandidates(sheet, data.items, current, owner)
        val projected = sheet.copy(data = applySheetPatches(sheet.data, costs))
        val endings =
            if (owner && current.kind == "attack")
                endingStatusPatches(projected, data.items, "attack")
            else emptyList()
        val patches = costs + endings
        val id = displayId
        if (session != null && prepared != null && owner) {
            val before = patches.map { patch ->
                val old = sheetValue(sheet.data, patch.path)
                SheetPrecondition(patch.path, old != null, old ?: JsonNull)
            }
            val intent = buildJsonObject {
                put("sessionUuid", session)
                current.eventData.text("weaponUseId").takeIf(String::isNotBlank)?.let { use ->
                    put(
                        "weaponUse",
                        buildJsonObject {
                            put("uid", current.targetUid)
                            put("id", use)
                        },
                    )
                }
                put("prepared", WireJson.parseToJsonElement(WireJson.encodeToString(prepared)))
                put("patches", WireJson.parseToJsonElement(WireJson.encodeToString(patches)))
                put("before", WireJson.parseToJsonElement(WireJson.encodeToString(before)))
            }
            val presentation = buildJsonObject {
                put("id", id)
                put("request", WireJson.parseToJsonElement(WireJson.encodeToString(request)))
                put("triggers", WireJson.parseToJsonElement(WireJson.encodeToString(triggers)))
                put("reroll", rerollOf != null)
            }
            val reply =
                requireNotNull(commands).send("dice-roll", intent, presentation = presentation)
            return SheetRollRecord(
                id,
                request,
                WireJson.decodeFromJsonElement(reply.getValue("roll")),
                prepared,
                triggers,
                rerollOf != null,
                System.currentTimeMillis(),
                reply["eventId"]?.jsonPrimitive?.longOrNull,
                sessionUuid = session,
            )
        }
        val result =
            if (prepared != null)
                resolvePreparedD20(
                    prepared,
                    List(if (prepared.mode == "normal") 1 else 2) { Random.nextInt(1, 21) },
                )
            else rollSheet(current, derived, mode)
        val record =
            SheetRollRecord(
                id,
                request,
                result,
                prepared,
                triggers,
                rerollOf != null,
                System.currentTimeMillis(),
                sessionUuid = session,
            )
        val useId = current.eventData.text("weaponUseId")
        val weaponUpdate =
            if (useId.isNotBlank()) {
                val use = weaponUseState(projected, current.targetUid)
                require(use.text("id") == useId && use.text("status") == "active") {
                    "Это применение оружия уже завершено."
                }
                listOf(
                    weaponUsePatch(
                        projected,
                        current.targetUid,
                        JsonObject(
                            use +
                                mapOf(
                                    "attack_result" to diceResultData(result),
                                    "critical" to
                                        JsonPrimitive(
                                            (result.selected ?: 0) >= current.criticalThreshold
                                        ),
                                )
                        ),
                    )
                )
            } else emptyList()
        val checkpoint =
            CachedSheetSection(uuid, SheetRollRecord.SECTION, WireJson.encodeToString(record))
        if (owner) {
            val event =
                spellConcentrationData(current, diceEventData(current, result), concentration())
            val metadata =
                if (session == null) listOf(buildJsonObject { put("roll", event) })
                else sessionMetadata(session, "dice_roll", current.title, event)
            sheets.enqueue(
                uuid,
                patches + weaponUpdate,
                sheet.data,
                metadata = metadata,
                checkpoint = checkpoint,
            )
        } else cache.putSection(checkpoint)
        return record
    }
}
