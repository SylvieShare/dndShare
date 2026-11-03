package ru.dndshare.client.maps.rendering

import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.selects.select
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.sync.withPermit
import ru.dndshare.client.network.ApiException

enum class MapDownloadPhase {
    Queued,
    Loading,
    Processing,
    Retrying,
    Ready,
    Failed,
}

/** Identity ties a shared non-file request to its result type. */
class MapDownloadKey<T>(val url: String)

internal class MapPermanentLoadException(message: String) : Exception(message)

internal class MapAttemptException(val original: Exception, val progress: MapDownload) :
    Exception(original.message, original)

private data class MapAttemptFailure(val error: Exception, val progress: MapDownload)

internal fun mapLoadMessage(message: String) =
    message
        .replace(Regex("https?://[^\\s)]+")) { it.value.substringBefore('?').substringBefore('#') }
        .take(2000)

data class MapDownload(
    val url: String,
    val phase: MapDownloadPhase = MapDownloadPhase.Queued,
    val attempt: Int = 0,
    val loaded: Long = 0,
    val total: Long? = null,
    val error: String? = null,
    val httpStatus: Int? = null,
    val retryAt: Long? = null,
)

internal fun mapDownloadRetryable(error: Exception): Boolean {
    val cause = if (error is MapAttemptException) error.original else error
    return cause !is MapPermanentLoadException &&
        (cause !is ApiException ||
            cause.status == 408 ||
            cause.status == 429 ||
            cause.status >= 500)
}

internal fun mapDownloadRetryDelay(attempt: Int): Long =
    minOf(30_000L, 1000L shl (attempt - 1).coerceIn(0, 5))

/** Shared jobs have counted consumers; retry delays never occupy an active download slot. */
class MapDownloads(
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO),
    private val now: () -> Long = System::currentTimeMillis,
) {
    private class Request<T>(
        val url: String,
        val history: MapAttemptFailure?,
        val keepBackoff: Boolean,
    ) {
        var owners = 0
        lateinit var result: Deferred<Result<T>>
        val retry = Channel<Unit>(Channel.CONFLATED)
        val progress = MutableStateFlow(history?.progress ?: MapDownload(url))
        val failure = MutableStateFlow(history)
    }

    private val lock = Mutex()
    private val priorities = ConcurrentHashMap<Any, Map<String, Int>>()

    fun priorities(owner: Any, urls: Map<String, Int>) {
        if (urls.isEmpty()) priorities.remove(owner) else priorities[owner] = urls.toMap()
    }

    internal fun priority(url: String) =
        if (url == "/api/maps/models") 1000 else priorities.values.maxOfOrNull { it[url] ?: 0 } ?: 0

    private val slots = MapPriorityGate(3, ::priority)
    private val jobs = mutableMapOf<Any, Request<*>>()
    private val presentations = ConcurrentHashMap<String, Request<*>>()
    private val cooldowns = ConcurrentHashMap<String, MapAttemptFailure>()
    private val mutable = MutableStateFlow<Map<String, MapDownload>>(emptyMap())
    val state: StateFlow<Map<String, MapDownload>> = mutable.asStateFlow()

    private fun publish(request: Request<*>, change: (MapDownload) -> MapDownload) {
        val url = request.url
        val value = request.progress.updateAndGet(change)
        mutable.update { records ->
            if (presentations[url] !== request) return@update records
            val next = (records - url) + (url to value)
            val completed =
                next.values.filter {
                    it.phase in setOf(MapDownloadPhase.Ready, MapDownloadPhase.Failed)
                }
            next - completed.take((completed.size - 128).coerceAtLeast(0)).map { it.url }.toSet()
        }
    }

    suspend fun read(
        url: String,
        oneAttempt: Boolean = false,
        operation: suspend ((Long, Long?) -> Unit) -> ByteArray,
    ): ByteArray = shared(url, url, oneAttempt, operation)

    suspend fun <T> read(key: MapDownloadKey<T>, operation: suspend () -> T): T =
        shared(key, key.url, false) { operation() }

    private suspend fun <T> shared(
        key: Any,
        url: String,
        oneAttempt: Boolean,
        operation: suspend ((Long, Long?) -> Unit) -> T,
    ): T {
        if (key is String)
            cooldowns[url]
                ?.takeIf {
                    it.progress.phase == MapDownloadPhase.Failed ||
                        oneAttempt && (it.progress.retryAt ?: 0) > now()
                }
                ?.let { throw MapAttemptException(it.error, it.progress) }
        val request = lock.withLock {
            // String keys always carry bytes; identity keys carry exactly their declared T.
            @Suppress("UNCHECKED_CAST")
            val task =
                (jobs[key] as? Request<T>)
                    ?: Request<T>(url, if (key is String) cooldowns[url] else null, key is String)
                        .also { task ->
                            task.result =
                                scope.async(start = CoroutineStart.LAZY) {
                                    try {
                                        Result.success(run(task, operation))
                                    } catch (cancelled: CancellationException) {
                                        throw cancelled
                                    } catch (failure: Exception) {
                                        Result.failure(failure)
                                    }
                                }
                            jobs[key] = task
                            presentations[url] = task
                        }
            task.owners++
            task
        }
        request.result.start()
        try {
            return if (oneAttempt) attempt(request) else request.result.await().getOrThrow()
        } finally {
            // A cancelled caller must still release its lease on the shared request.
            withContext(NonCancellable) {
                lock.withLock {
                    request.owners--
                    if (request.owners == 0) {
                        if (jobs[key] === request) jobs.remove(key)
                        request.result.cancel()
                        request.retry.close()
                        if (
                            presentations.remove(url, request) &&
                                mutable.value[url]?.phase !in
                                    setOf(MapDownloadPhase.Ready, MapDownloadPhase.Failed)
                        )
                            mutable.update { it - url }
                    }
                }
            }
        }
    }

    /** The scene releases its bounded preparation slot while the shared network job backs off. */
    private suspend fun <T> attempt(request: Request<T>): T = coroutineScope {
        val current = request.progress.value
        if (current.phase == MapDownloadPhase.Retrying && (current.retryAt ?: 0) > now())
            request.failure.value
                ?.takeIf { it.progress.attempt >= current.attempt }
                ?.let { throw MapAttemptException(it.error, it.progress) }
        val expected =
            maxOf(
                1,
                current.attempt +
                    if (
                        current.phase in
                            setOf(
                                MapDownloadPhase.Queued,
                                MapDownloadPhase.Retrying,
                                MapDownloadPhase.Failed,
                            )
                    )
                        1
                    else 0,
            )
        val failed =
            async(start = CoroutineStart.UNDISPATCHED) {
                request.failure.filterNotNull().first { it.progress.attempt >= expected }
            }
        try {
            select {
                request.result.onAwait { it.getOrThrow() }
                failed.onAwait { throw MapAttemptException(it.error, it.progress) }
            }
        } finally {
            failed.cancel()
        }
    }

    private suspend fun <T> run(
        request: Request<T>,
        operation: suspend ((Long, Long?) -> Unit) -> T,
    ): T {
        val url = request.url
        val owner = currentCoroutineContext()
        var attempt = request.progress.value.attempt
        publish(request) { it }
        val initialWait = (request.history?.progress?.retryAt ?: 0) - now()
        if (initialWait > 0) withTimeoutOrNull(initialWait) { request.retry.receive() }
        while (true) {
            try {
                return slots.withPermit(url) {
                    attempt++
                    publish(request) {
                        it.copy(
                            phase = MapDownloadPhase.Loading,
                            attempt = attempt,
                            loaded = 0,
                            retryAt = null,
                        )
                    }
                    var lastProgress = Long.MIN_VALUE
                    val result = operation { loaded, total ->
                        owner.ensureActive()
                        val time = now()
                        if (
                            lastProgress == Long.MIN_VALUE ||
                                time - lastProgress >= 100 ||
                                total != null && loaded >= total
                        ) {
                            lastProgress = time
                            publish(request) {
                                it.copy(
                                    phase =
                                        if (total != null && loaded >= total)
                                            MapDownloadPhase.Processing
                                        else MapDownloadPhase.Loading,
                                    loaded = loaded,
                                    total = total,
                                )
                            }
                        }
                    }
                    owner.ensureActive()
                    val bytes = result as? ByteArray
                    if (presentations[url] === request) cooldowns.remove(url)
                    publish(request) {
                        it.copy(
                            phase = MapDownloadPhase.Ready,
                            loaded = bytes?.size?.toLong() ?: it.loaded,
                            total = bytes?.size?.toLong() ?: it.total,
                            error = null,
                            httpStatus = null,
                            retryAt = null,
                        )
                    }
                    result
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                val retry = mapDownloadRetryable(failure)
                val delay = mapDownloadRetryDelay(attempt)
                publish(request) {
                    it.copy(
                        phase = if (retry) MapDownloadPhase.Retrying else MapDownloadPhase.Failed,
                        loaded = 0,
                        error =
                            mapLoadMessage(failure.message ?: "Не удалось загрузить ресурс карты"),
                        httpStatus = (failure as? ApiException)?.status,
                        retryAt = if (retry) now() + delay else null,
                    )
                }
                val attemptFailure = MapAttemptFailure(failure, request.progress.value)
                if (request.keepBackoff && presentations[url] === request) {
                    cooldowns[url] = attemptFailure
                    if (cooldowns.size > 128)
                        cooldowns.entries
                            .sortedBy { it.value.progress.retryAt }
                            .take(cooldowns.size - 128)
                            .forEach { cooldowns.remove(it.key, it.value) }
                }
                request.failure.value = attemptFailure
                if (!retry) throw failure
                withTimeoutOrNull(delay) { request.retry.receive() }
                publish(request) { it.copy(phase = MapDownloadPhase.Queued) }
            }
        }
    }

    suspend fun retry() = lock.withLock {
        cooldowns.clear()
        jobs.values
            .filter { mutable.value[it.url]?.phase == MapDownloadPhase.Retrying }
            .forEach { it.retry.trySend(Unit) }
    }

    suspend fun invalidate(key: MapDownloadKey<*>) = invalidateKey(key)

    suspend fun invalidate(url: String) = invalidateKey(url)

    private suspend fun invalidateKey(key: Any) = lock.withLock {
        val url = if (key is MapDownloadKey<*>) key.url else key as String
        cooldowns.remove(url)
        jobs.remove(key)?.let { request ->
            if (presentations.remove(request.url, request)) mutable.update { it - request.url }
        }
    }
}
