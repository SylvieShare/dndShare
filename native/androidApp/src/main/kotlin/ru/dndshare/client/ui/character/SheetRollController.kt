package ru.dndshare.client.ui.character

import androidx.lifecycle.SavedStateHandle
import java.util.UUID
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*

internal class SheetRollController(
    private val uuid: String,
    private val sheets: CharacterSheetRepository,
    private val content: () -> SheetContentState,
    private val session: () -> String?,
    private val commands: CharacterCommandQueue?,
    private val scope: CoroutineScope,
    private val saved: SavedStateHandle,
    private val concentration: () -> JsonObject? = { null },
    private val cache: CharacterSheetDao,
    private val accountId: Long,
) {
    private val mutable = MutableStateFlow(SheetRollUiState())
    private val notices = SheetDiceNoticeStore()
    private val records = linkedMapOf<String, SheetRollRecord>()
    private val consumed = mutableSetOf<String>()
    private val rejected = mutableSetOf<Pair<String, String>>()
    private val executor =
        SheetRollExecutor(uuid, accountId, sheets, cache, commands, content, session, concentration)
    val state =
        combine(mutable, commands?.state ?: MutableStateFlow(CharacterCommandState())) { ui, command
                ->
                ui.copy(busy = ui.busy || command.busy || command.pending)
            }
            .stateIn(scope, SharingStarted.Eagerly, SheetRollUiState())

    init {
        saved[KEY] = null
        scope.launch {
            cache
                .observeSection(uuid, SheetRollRecord.SECTION)
                .distinctUntilChanged()
                .filterNotNull()
                .collect { raw ->
                    val record =
                        runCatching { WireJson.decodeFromString<SheetRollRecord>(raw) }.getOrNull()
                            ?: return@collect
                    if (!mutable.value.busy)
                        accept(
                            record,
                            show = System.currentTimeMillis() - record.completedAt < 7_000,
                        )
                }
        }
    }

    private fun busy() =
        mutable.value.busy || commands?.state?.value?.let { it.busy || it.pending } == true

    private fun update(value: SheetRollUiState) {
        mutable.value = notices.update(value, consumed, rejected)
    }

    private fun accept(record: SheetRollRecord, show: Boolean = true) {
        records[record.id] = record
        while (records.size > 32) {
            val old = records.keys.first()
            records.remove(old)
            consumed.remove(old)
            rejected.removeAll { it.first == old }
        }
        if (!show) return
        update(
            SheetRollUiState(
                request = record.request,
                mode = record.request.manualMode,
                result = record.result,
                recordId = record.id,
                completedAt = record.completedAt,
                actions =
                    if (record.id in consumed) emptyList()
                    else record.actions().filter { (record.id to it.key) !in rejected },
            )
        )
    }

    fun rerollForUse(uid: String, key: String): SheetRerollOffer? {
        val record = records.values.lastOrNull { it.prepared != null } ?: return null
        if (record.id in consumed || record.sessionUuid != session()) return null
        val action =
            record.actions().firstOrNull {
                it.useUid == uid && it.useKey == key && (record.id to it.key) !in rejected
            } ?: return null
        return SheetRerollOffer(
            record.id,
            action.key,
            record.request.title,
            record.request.targetUid,
            record.request.eventData.text("weaponUseId"),
        )
    }

    fun reroll(key: String) = rerollRecord(mutable.value.recordId, key)

    fun reroll(offer: SheetRerollOffer) = rerollRecord(offer.recordId, offer.key)

    private fun rerollRecord(id: String, key: String) {
        if (busy()) return
        val record = records[id] ?: return
        if (record.id in consumed || (record.id to key) in rejected) return
        notices.dismiss(record.id)
        update(
            SheetRollUiState(
                request = record.request,
                mode = record.request.manualMode,
                result = null,
                busy = true,
                recordId = UUID.randomUUID().toString(),
            )
        )
        val operationId = mutable.value.recordId
        scope.launch {
            try {
                val next =
                    executor.execute(
                        record.request,
                        record.result.mode,
                        record,
                        key,
                        displayId = operationId,
                    )
                consumed.add(record.id)
                accept(next)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                if (error !is ru.dndshare.client.network.ApiException || error.status != 409)
                    rejected.add(record.id to key)
                update(
                    mutable.value.copy(
                        busy = false,
                        error = error.message,
                        actions = record.actions().filter { (record.id to it.key) !in rejected },
                    )
                )
            }
        }
    }

    fun open(request: SheetRollRequest) {
        if (busy()) return
        update(SheetRollUiState(request = request, mode = request.manualMode))
        runRoll()
    }

    fun close() = close(mutable.value.recordId)

    fun close(id: String) {
        notices.dismiss(id)
        update(
            if (mutable.value.recordId == id && !mutable.value.busy) SheetRollUiState()
            else mutable.value
        )
    }

    fun mode(id: String, value: String) {
        if (busy()) return
        notices.mode(id, value)
        update(
            if (mutable.value.recordId == id) mutable.value.copy(mode = value, error = null)
            else mutable.value
        )
    }

    fun repeat(id: String) {
        if (busy()) return
        val notice = notices.row(id) ?: return
        update(
            SheetRollUiState(
                request = notice.request,
                mode = notice.mode,
                result = notice.result,
                recordId = id,
            )
        )
        roll()
    }

    fun reroll(id: String, key: String) = rerollRecord(id, key)

    fun roll() {
        val current = mutable.value
        val request = current.request ?: return
        if (!request.repeatable || current.busy) return
        if (request.spellOptions != null) {
            val options = WireJson.decodeFromJsonElement<SpellRollOptions>(request.spellOptions)
            spell(request.spellKey, options.copy(mode = current.mode))
            return
        }
        if (request.weaponOptions != null) {
            val options = WireJson.decodeFromJsonElement<WeaponRollOptions>(request.weaponOptions)
            if (request.kind == "attack")
                attack(
                    request.targetUid,
                    options.copy(mode = current.mode, excludedBonuses = request.excludedBonuses),
                )
            else damage(request.targetUid, options)
            return
        }
        update(
            current.copy(
                result = null,
                recordId = UUID.randomUUID().toString(),
                completedAt = 0,
                error = null,
            )
        )
        runRoll()
    }

    fun spell(key: String, options: SpellRollOptions) {
        if (busy()) return
        val encoded = WireJson.parseToJsonElement(WireJson.encodeToString(options)).jsonObject
        val previous =
            saved.get<String>("sheet.spell-options")?.let {
                WireJson.parseToJsonElement(it).jsonObject
            } ?: JsonObject(emptyMap())
        saved["sheet.spell-options"] =
            JsonObject((previous - key).toList().takeLast(31).toMap() + (key to encoded)).toString()
        update(
            SheetRollUiState(
                request =
                    SheetRollRequest(
                        "Бросок заклинания",
                        options.kind,
                        formula = if (options.kind == "attack") null else "0",
                        spellKey = key,
                        spellOptions = encoded,
                    ),
                mode = options.mode,
                busy = true,
            )
        )
        val operationId = mutable.value.recordId
        scope.launch {
            try {
                val sheet = requireNotNull(sheets.local(uuid)).displayed
                val data = content()
                val request = spellRollRequest(sheet, key, options, data.items, data.metadata)
                update(
                    mutable.value.copy(
                        request = request,
                        mode = options.mode,
                        busy = false,
                        recordId = operationId,
                    )
                )
                runRoll()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                update(mutable.value.copy(busy = false, error = error.message))
            }
        }
    }

    fun spellOptions(key: String): SpellRollOptions? =
        saved.get<String>("sheet.spell-options")?.let {
            WireJson.parseToJsonElement(it).jsonObject[key]?.let { raw ->
                WireJson.decodeFromJsonElement<SpellRollOptions>(raw)
            }
        }

    private fun runRoll() {
        val current = mutable.value
        val request = current.request ?: return
        if (current.busy || commands?.state?.value?.pending == true) return
        update(current.copy(busy = true, error = null))
        scope.launch {
            try {
                accept(executor.execute(request, current.mode, displayId = current.recordId))
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                update(
                    mutable.value.copy(
                        busy = false,
                        error = error.message ?: "Не удалось выполнить бросок.",
                    )
                )
            }
        }
    }

    fun attack(uid: String, options: WeaponRollOptions) {
        if (busy()) return
        val encoded = WireJson.parseToJsonElement(WireJson.encodeToString(options)).jsonObject
        update(
            SheetRollUiState(
                request =
                    SheetRollRequest("Атака", "attack", targetUid = uid, weaponOptions = encoded),
                mode = options.mode,
                busy = true,
            )
        )
        val operationId = mutable.value.recordId
        scope.launch {
            try {
                var sheet = requireNotNull(sheets.local(uuid)).displayed
                val data = content()
                val selections =
                    weaponTargetSelectionPatches(sheet, uid, options, data.items, data.metadata)
                if (selections.isNotEmpty()) {
                    sheets.enqueue(uuid, selections, sheet.data)
                    sheet = sheet.copy(data = applySheetPatches(sheet.data, selections))
                }
                val request = weaponAttackRequest(sheet, uid, options, data.items, data.metadata)
                update(mutable.value.copy(request = request, busy = false, recordId = operationId))
                runRoll()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                update(mutable.value.copy(busy = false, error = error.message))
            }
        }
    }

    fun damage(uid: String, options: WeaponRollOptions) {
        if (busy()) return
        val encoded = WireJson.parseToJsonElement(WireJson.encodeToString(options)).jsonObject
        update(
            SheetRollUiState(
                request =
                    SheetRollRequest(
                        "Урон",
                        "damage",
                        formula = "0",
                        targetUid = uid,
                        weaponOptions = encoded,
                    ),
                busy = true,
            )
        )
        val operationId = mutable.value.recordId
        scope.launch {
            try {
                val sheet = requireNotNull(sheets.local(uuid)).displayed
                val data = content()
                val plan = weaponDamagePlan(sheet, uid, options, data.items, data.metadata)
                val result =
                    rollSheet(plan.request, DndDerivedValues(sheet, data.items, data.metadata))
                val event =
                    JsonObject(
                        diceEventData(plan.request, result) +
                            buildJsonObject {
                                if (plan.costs.isNotEmpty())
                                    put(
                                        "resourceChanges",
                                        buildJsonArray {
                                            plan.costs.forEach { cost ->
                                                add(
                                                    buildJsonObject {
                                                        put("key", cost.resource.key)
                                                        put("name", cost.resource.title)
                                                        put("delta", -cost.amount)
                                                        put(
                                                            "remaining",
                                                            cost.resource.value - cost.amount,
                                                        )
                                                        put("total", cost.resource.total)
                                                    }
                                                )
                                            }
                                        },
                                    )
                            }
                    )
                val session = session()
                val record =
                    SheetRollRecord(
                        operationId,
                        plan.request,
                        result,
                        completedAt = System.currentTimeMillis(),
                    )
                val metadata =
                    if (session == null) listOf(buildJsonObject { put("roll", event) })
                    else sessionMetadata(session, "dice_roll", plan.request.title, event)
                sheets.enqueue(
                    uuid,
                    plan.patches,
                    sheet.data,
                    metadata = metadata,
                    checkpoint =
                        CachedSheetSection(
                            uuid,
                            SheetRollRecord.SECTION,
                            WireJson.encodeToString(record),
                        ),
                )
                accept(record)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                update(
                    mutable.value.copy(
                        busy = false,
                        error = error.message ?: "Не удалось бросить урон.",
                    )
                )
            }
        }
    }

    companion object {
        private const val KEY = "sheet.roll"
    }
}
