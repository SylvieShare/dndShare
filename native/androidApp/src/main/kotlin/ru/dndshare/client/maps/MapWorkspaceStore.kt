package ru.dndshare.client.maps

import android.util.AtomicFile
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import ru.dndshare.client.model.WireJson

/** Actor-specific private storage; an expired session never destroys the draft. */
class MapWorkspaceStore(private val directory: File) {
    private class SharedDirectory {
        val lock = Mutex()
        val pending = ConcurrentHashMap<String, MapWork>()
        val deleted = ConcurrentHashMap.newKeySet<String>()
    }

    companion object {
        private val directories = ConcurrentHashMap<String, SharedDirectory>()
    }

    private val shared = directories.computeIfAbsent(directory.canonicalPath) { SharedDirectory() }
    private val lock = shared.lock

    private fun file(key: String): AtomicFile {
        require(key.matches(Regex("[a-zA-Z0-9_.-]+")))
        return AtomicFile(File(directory, "$key.json"))
    }

    private inline fun <reified T> read(key: String): T? {
        val source = file(key)
        if (!source.baseFile.exists() && !File(source.baseFile.path + ".bak").exists()) return null
        return WireJson.decodeFromString(source.openRead().bufferedReader().use { it.readText() })
    }

    private inline fun <reified T> write(key: String, value: T) {
        directory.mkdirs()
        val target = file(key)
        val stream = target.startWrite()
        try {
            stream.write(WireJson.encodeToString(value).toByteArray())
            target.finishWrite(stream)
        } catch (error: Exception) {
            target.failWrite(stream)
            throw error
        }
    }

    suspend fun drafts(): List<MapWork> =
        withContext(Dispatchers.IO) {
            lock.withLock {
                val keys =
                    directory
                        .listFiles()
                        .orEmpty()
                        .filter {
                            it.name.startsWith("draft-") &&
                                (it.name.endsWith(".json") || it.name.endsWith(".json.bak"))
                        }
                        .map {
                            it.name
                                .removePrefix("draft-")
                                .removeSuffix(".bak")
                                .removeSuffix(".json")
                        }
                (keys + shared.pending.keys).distinct().mapNotNull(::currentWork).filter {
                    it.dirty
                }
            }
        }

    suspend fun open(map: BattleMap): MapWork =
        withContext(Dispatchers.IO) {
            lock.withLock {
                require(map.id.isNotBlank())
                shared.deleted.remove(map.id)
                rememberOwn(map)
                val stored = currentWork(map.id)
                if (stored?.dirty == true) stored
                else
                    MapWork(
                            key = map.id,
                            confirmed = map,
                            localVersion = (stored?.localVersion ?: 0) + 1,
                            ui = stored?.ui,
                            undo =
                                stored
                                    ?.takeIf { it.current.content == map.content }
                                    ?.undo
                                    .orEmpty(),
                            redo =
                                stored
                                    ?.takeIf { it.current.content == map.content }
                                    ?.redo
                                    .orEmpty(),
                        )
                        .also { write("draft-${map.id}", it) }
            }
        }

    suspend fun readWork(id: String): MapWork? =
        withContext(Dispatchers.IO) { lock.withLock { currentWork(id) } }

    private fun currentWork(id: String): MapWork? {
        if (id in shared.deleted) return null
        val written = read<MapWork>("draft-$id")
        val staged = shared.pending[id]
        return if (staged != null && staged.localVersion >= (written?.localVersion ?: -1)) staged
        else written
    }

    suspend fun replace(map: BattleMap, minimumVersion: Long): MapWork =
        withContext(Dispatchers.IO) {
            lock.withLock {
                val previous = currentWork(map.id)
                MapWork(
                        key = map.id,
                        confirmed = map,
                        localVersion = maxOf(minimumVersion, previous?.localVersion ?: 0) + 1,
                        ui = previous?.ui,
                    )
                    .also { write("draft-${map.id}", it) }
            }
        }

    suspend fun put(work: MapWork) {
        if (work.key in shared.deleted) return
        shared.pending.compute(work.key) { _, old ->
            if (old == null || old.localVersion <= work.localVersion) work else old
        }
        withContext(Dispatchers.IO) {
            lock.withLock {
                if (work.key in shared.deleted) {
                    shared.pending.remove(work.key)
                    return@withLock
                }
                val staged = shared.pending[work.key] ?: return@withLock
                val current = read<MapWork>("draft-${work.key}")
                if (current == null || current.localVersion <= staged.localVersion) {
                    write("draft-${work.key}", staged)
                    if (
                        !staged.dirty &&
                            (current?.current?.revision != staged.current.revision ||
                                current?.current?.content != staged.current.content ||
                                current?.current?.previewUrl != staged.current.previewUrl)
                    )
                        rememberOwn(staged.current)
                }
                shared.pending.remove(work.key, staged)
            }
        }
    }

    private fun rememberOwn(map: BattleMap) {
        if (!map.owned) return
        val list = read<List<BattleMap>>("list-own").orEmpty()
        if (list.any { it.id == map.id && it.revision > map.revision }) return
        val summary =
            map.copy(
                document = newMapDocument(),
                width = map.document.number("width"),
                height = map.document.number("height"),
                tileCount = map.document.rows("tiles").size,
                objectCount = map.document.rows("objects").size,
                tags =
                    (map.document["tags"] as? JsonArray).orEmpty().map { it.jsonPrimitive.content },
            )
        write("list-own", listOf(summary) + list.filter { it.id != map.id })
    }

    suspend fun cache(scope: String, maps: List<BattleMap>) =
        withContext(Dispatchers.IO) { lock.withLock { write("list-$scope", maps) } }

    suspend fun cached(scope: String): List<BattleMap>? =
        withContext(Dispatchers.IO) { lock.withLock { read<List<BattleMap>>("list-$scope") } }

    suspend fun models(value: List<MapModel>) =
        withContext(Dispatchers.IO) { lock.withLock { write("models", value) } }

    suspend fun models(): List<MapModel>? =
        withContext(Dispatchers.IO) { lock.withLock { read<List<MapModel>>("models") } }

    suspend fun forget(id: String) =
        withContext(Dispatchers.IO) {
            lock.withLock {
                shared.deleted += id
                shared.pending.remove(id)
                file("draft-$id").delete()
                read<List<BattleMap>>("list-own")?.let { maps ->
                    write("list-own", maps.filter { it.id != id })
                }
            }
        }
}
