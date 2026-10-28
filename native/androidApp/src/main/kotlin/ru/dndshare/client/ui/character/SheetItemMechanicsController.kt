package ru.dndshare.client.ui.character

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

internal class SheetItemMechanicsController(
    private val uuid: String,
    private val accountId: Long,
    private val sheets: CharacterSheetRepository,
    private val content: () -> SheetContentState,
    private val session: () -> String?,
    private val commands: CharacterCommandQueue? = null,
    private val concentration: () -> JsonObject? = { null },
) {
    private val mutex = Mutex()

    suspend fun perform(uid: String, operation: String, input: JsonObject): String? =
        try {
            mutex.withLock {
                val sheet = requireNotNull(sheets.local(uuid)).displayed
                require(sheet.userId == accountId) { "Этот лист доступен только для просмотра." }
                val items = content().items
                if (operation in setOf("confirmed-use", "last-charge-roll", "last-charge-undo")) {
                    performConfirmedUse(
                        uuid,
                        uid,
                        operation,
                        input,
                        sheet,
                        content(),
                        session(),
                        sheets,
                    )
                    return@withLock
                }
                if (operation == "spell-save") {
                    performSpellSave(
                        uuid,
                        uid,
                        input,
                        sheet,
                        content(),
                        session(),
                        commands,
                        concentration(),
                    )
                    return@withLock
                }
                if (operation.startsWith("weapon-use-")) {
                    performWeaponUse(
                        uuid,
                        uid,
                        operation,
                        input,
                        sheet,
                        content(),
                        session(),
                        sheets,
                        commands,
                    )
                    return@withLock
                }
                val patches =
                    if (operation.startsWith("inventory-"))
                        inventoryActionPatches(sheet, uid, operation, input, items)
                    else if (operation == "created-expire") expireCreatedItemPatches(sheet, uid)
                    else if (operation == "spell-prepare")
                        listOf(
                            spellPreparationPatch(
                                sheet,
                                uid,
                                input["prepared"] == JsonPrimitive(true),
                                items,
                            )
                        )
                    else if (operation == "spell-slot")
                        listOf(
                            spellSlotUsedPatch(
                                sheet,
                                uid,
                                input["level"].number(),
                                input["used"].number(),
                            )
                        )
                    else if (operation == "feature-action")
                        featureActionPatches(sheet, uid, input, items)
                    else if (operation == "resource-set") {
                        val resource =
                            resourceControls(sheet, items).firstOrNull { it.key == uid }
                                ?: error("Ресурс недоступен.")
                        val next = input["value"].number(-1)
                        require(next in 0..resource.total) {
                            "Недопустимое количество использований."
                        }
                        resourceChangePatches(sheet, resource, next, items)
                    } else if (operation == "feature-widget")
                        featureWidgetPatches(sheet, uid, items)
                    else if (operation == "ability-status") {
                        val feature =
                            ownedFeatures(sheet, items).firstOrNull {
                                it.key == input.text("bucket") && featureEntryKey(it) == uid
                            } ?: error("Способность больше не существует.")
                        val link =
                            statusEffectLinks(feature.item).firstOrNull {
                                it.text("key") == input.text("link")
                            } ?: error("Эффект больше недоступен.")
                        listOf(toggleLinkedStatus(sheet, feature, link, items))
                    } else if (operation.startsWith("target-"))
                        selectedTargetPatch(
                            sheet,
                            items,
                            uid,
                            operation.removePrefix("target-"),
                            input,
                        )
                    else if (operation == "bonus-transfer")
                        weaponBonusTransferPatch(sheet, items, uid, input["amount"].number())
                    else error("Неизвестное действие предмета.")
                val changed = patches.filter { sheetValue(sheet.data, it.path) != it.value }
                if (changed.isNotEmpty()) {
                    val metadata =
                        if (operation.startsWith("target-") && operation != "target-select") {
                            val source = selectedWeaponTargets(sheet, items).first { it.uid == uid }
                            val label =
                                when (operation) {
                                    "target-declare" -> "объявлена цель"
                                    "target-defeat" -> "цель погибла"
                                    else -> "исправлен выбор цели"
                                }
                            sessionMetadata(
                                session(),
                                "feature_state",
                                "${source.item.name}: $label",
                                buildJsonObject {
                                    put(
                                        "source",
                                        buildJsonObject {
                                            put("itemId", source.item.id)
                                            put("name", source.item.name)
                                        },
                                    )
                                    put("instanceUid", uid)
                                    put("operation", operation.removePrefix("target-"))
                                },
                            )
                        } else itemMechanicMetadata(sheet, uid, operation, input, items, session())
                    sheets.enqueue(uuid, changed, sheet.data, metadata = metadata)
                }
            }
            null
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            error.message ?: "Не удалось изменить свойства предмета."
        }
}
