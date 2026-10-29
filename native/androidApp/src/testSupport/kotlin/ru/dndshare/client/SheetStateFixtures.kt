package ru.dndshare.client

import java.io.IOException
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.network.ApiException

class MemorySheetForms : CharacterSheetDao {
    val rows = MutableStateFlow<Map<String, CachedCharacterSheet>>(emptyMap())
    val forms = mutableMapOf<Pair<String, String>, CachedSheetForm>()
    val sections = MutableStateFlow<Map<Pair<String, String>, CachedSheetSection>>(emptyMap())

    override fun observeSection(uuid: String, section: String): Flow<String?> = sections.map {
        it[uuid to section]?.payload
    }

    override suspend fun putSection(section: CachedSheetSection) {
        sections.value += (section.uuid to section.section) to section
    }

    override suspend fun pendingCommands() =
        sections.value.values.filter { it.section == "remote-command" && it.payload != "{}" }

    override fun observe(uuid: String): Flow<CachedCharacterSheet?> = rows.map { it[uuid] }

    override suspend fun get(uuid: String) = rows.value[uuid]

    override suspend fun pending() = rows.value.values.filter { it.draft != "{}" }.map { it.uuid }

    override suspend fun put(sheet: CachedCharacterSheet) {
        rows.value = rows.value + (sheet.uuid to sheet)
    }

    override suspend fun form(uuid: String, id: String) = forms[uuid to id]

    override suspend fun openForms() = forms.values.toList()

    override suspend fun updateFormInputs(uuid: String, id: String, inputs: String): Int {
        val current = forms[uuid to id] ?: return 0
        forms[uuid to id] = current.copy(inputs = inputs)
        return 1
    }

    override suspend fun updateFormBaseline(uuid: String, id: String, baseline: String): Int {
        val current = forms[uuid to id] ?: return 0
        forms[uuid to id] = current.copy(baseline = baseline)
        return 1
    }

    override suspend fun putForm(form: CachedSheetForm) {
        forms[form.uuid to form.id] = form
    }

    override suspend fun removeForm(uuid: String, id: String) {
        forms.remove(uuid to id)
    }
}

class SheetStateServer : CharacterSheetApi {
    var sheet =
        CharacterSheet(
            "DND5",
            1,
            WireJson.parseToJsonElement(
                    """{
      "values":{"name":"Лира","hp":{"current":10,"temp":2,"max":{"base":20,"bonuses":[]},"history":[]},
      "STR":{"value":{"base":12,"bonuses":[]}},"states":[],"inspiration":false,"exhaustion":{"level":0}}
    }"""
                )
                .jsonObject,
            1,
            sourceId = 1,
        )
    var dropResponse = false
    var reads = 0
    val packets = mutableListOf<SheetPacket>()
    val accepted = mutableMapOf<String, Pair<SheetPacket, SheetChange>>()

    override suspend fun character(uuid: String): CharacterSheet {
        reads++
        return sheet
    }

    override suspend fun saveCharacter(uuid: String, packet: SheetPacket): SheetChange {
        packets += packet
        accepted[packet.mutationId]?.let { (original, receipt) ->
            check(original == packet)
            return receipt
        }
        if (packet.baseVersion != sheet.version) throw ApiException(409, "CONFLICT", "Conflict")
        val change =
            SheetChange(sheet.version, sheet.version + 1, packet.mutationId, packet.patches)
        sheet =
            sheet.copy(
                data = applySheetPatches(sheet.data, packet.patches),
                version = change.version,
            )
        accepted[packet.mutationId] = packet to change
        if (dropResponse) {
            dropResponse = false
            throw IOException("Lost acknowledgement")
        }
        return change
    }

    fun remote(path: List<JsonElement>, value: JsonElement) {
        sheet =
            sheet.copy(
                version = sheet.version + 1,
                data =
                    applySheetPatches(sheet.data, listOf(SheetPatch(path = path, value = value))),
            )
    }
}
