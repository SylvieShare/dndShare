package ru.dndshare.client.maps.rendering

import kotlinx.coroutines.*
import ru.dndshare.client.network.ApiException

/** Pipeline retries own no preparation/upload slot while waiting, and stop with their owner. */
internal class MapAssetRetries(
    private val scope: CoroutineScope,
    private val wanted: (String) -> Boolean,
    private val invalidate: suspend (String, String) -> Unit,
    private val load: (String) -> Unit,
    private val changed: () -> Unit,
    private val transfer: (String) -> MapDownload? = { null },
) : AutoCloseable {
    private val failures = linkedMapOf<String, MapSceneLoadFailure>()
    private val attempts = mutableMapOf<String, Int>()
    private val jobs = mutableMapOf<String, Job>()
    val issues
        get() = failures.toMap()

    val message
        get() = failures.values.firstOrNull()?.message

    operator fun contains(key: String) = key in failures

    fun starting(key: String) {
        attempts[key] = (attempts[key] ?: 0) + 1
    }

    fun ready(key: String) {
        failures.remove(key)
        attempts.remove(key)
        jobs.remove(key)?.cancel()
        changed()
    }

    fun fail(key: String, error: Exception, stage: String, url: String = key) {
        val cause = (error as? MapAttemptException)?.original ?: error
        val source = (error as? MapAttemptException)?.progress ?: transfer(key)
        val attempt = maxOf(attempts[key] ?: 1, source?.attempt ?: 1)
        attempts[key] = attempt
        val retry = mapDownloadRetryable(cause)
        failures[key] =
            MapSceneLoadFailure(
                mapLoadMessage(cause.message ?: "Не удалось подготовить модель"),
                if (error is MapAttemptException) "download" else stage,
                attempt,
                retry,
                (cause as? ApiException)?.status,
                source?.total,
                source?.url ?: url,
            )
        if (retry) schedule(key, mapDownloadRetryDelay(attempt))
        changed()
    }

    private fun schedule(key: String, wait: Long) {
        jobs.remove(key)?.cancel()
        val job =
            scope.launch(start = CoroutineStart.LAZY) {
                try {
                    if (wait > 0) delay(wait)
                    if (!wanted(key)) return@launch
                    invalidate(key, failures[key]?.stage ?: "scene")
                    if (wanted(key)) load(key)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: Exception) {
                    failures[key] =
                        MapSceneLoadFailure(
                            mapLoadMessage(error.message ?: "Не удалось повторить загрузку"),
                            "scene",
                            attempts[key] ?: 1,
                        )
                    changed()
                } finally {
                    if (jobs[key] === coroutineContext[Job]) jobs.remove(key)
                }
            }
        jobs[key] = job
        job.start()
    }

    fun retry() {
        for (key in failures.keys.toList()) {
            failures[key] = failures.getValue(key).copy(retrying = true)
            schedule(key, 0)
        }
        changed()
    }

    fun retain(keys: Set<String>) {
        jobs.keys.filter { it !in keys }.forEach { jobs.remove(it)?.cancel() }
        failures.keys.retainAll(keys)
        attempts.keys.retainAll(keys)
    }

    override fun close() {
        jobs.values.forEach(Job::cancel)
        jobs.clear()
        failures.clear()
        attempts.clear()
    }
}
