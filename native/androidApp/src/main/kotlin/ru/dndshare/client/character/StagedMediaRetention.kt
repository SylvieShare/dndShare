package ru.dndshare.client.character

import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import ru.dndshare.client.data.ClientDatabase
import ru.dndshare.client.device.DeviceServices
import ru.dndshare.client.model.WireJson

/** Decode nested persisted JSON too: a backup contains serialized form/command input strings. */
internal fun retainedMediaPaths(records: List<String>): Set<String> = buildSet {
    fun collect(node: JsonElement, depth: Int) {
        require(depth <= 32) { "Слишком глубокий черновик." }
        when (node) {
            is JsonObject -> node.values.forEach { collect(it, depth + 1) }
            is JsonArray -> node.forEach { collect(it, depth + 1) }
            is JsonPrimitive ->
                if (node.isString) {
                    val value = node.content
                    if (value.startsWith('{') || value.startsWith('[')) {
                        // Free-form text can start with a brace; only embedded serialized JSON is
                        // parsed.
                        runCatching { WireJson.parseToJsonElement(value) }
                            .getOrNull()
                            ?.let { collect(it, depth + 1) }
                    } else if (File(value).isAbsolute) add(File(value).canonicalPath)
                }
        }
    }
    for (record in records) collect(WireJson.parseToJsonElement(record), 0)
}

/** A grace period covers interrupted staging before its path reaches the durable form. */
internal fun pruneStagedMedia(folder: File, retained: Set<String>, now: Long): Int {
    val root = folder.canonicalFile
    var removed = 0
    for (file in root.listFiles().orEmpty()) {
        if (!file.isFile || file.canonicalFile.parentFile != root) continue
        if (file.canonicalPath in retained || now - file.lastModified() < 24 * 60 * 60 * 1000L)
            continue
        if (file.delete()) removed++
    }
    return removed
}

/** Called before exposing an account to UI. Corrupt/unreadable retained work disables pruning. */
suspend fun cleanStagedCharacterMedia(platform: DeviceServices, database: ClientDatabase) =
    withContext(Dispatchers.IO) {
        val records = mutableListOf<String>()
        for (key in
            platform.secureStore.keys().filter {
                it.startsWith("character-creation:") || it.startsWith("character-sheet-drafts:")
            }) {
            records.add(platform.secureStore.read(key) ?: return@withContext)
        }
        records.addAll(database.characterSheets().openForms().map { it.inputs })
        records.addAll(database.characterSheets().pendingCommands().map { it.payload })
        val retained = runCatching { retainedMediaPaths(records) }.getOrNull() ?: return@withContext
        pruneStagedMedia(File(platform.stagedMediaDirectory), retained, platform.nowMillis())
    }
