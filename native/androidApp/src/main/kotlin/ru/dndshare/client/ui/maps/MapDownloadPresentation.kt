package ru.dndshare.client.ui.maps

import java.net.URI
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

internal data class MapLoadingFile(
    val state: MapDownload,
    val kind: String,
    val models: List<MapModel> = emptyList(),
    val expected: Long = 0,
    val stage: String = if (kind == "catalogue") "catalogue" else "download",
) {
    val ready
        get() = state.phase == MapDownloadPhase.Ready

    val total
        get() = maxOf(expected, state.total ?: 0, state.loaded)

    val loaded
        get() =
            if (ready) total
            else if (state.phase in setOf(MapDownloadPhase.Failed, MapDownloadPhase.Retrying)) 0
            else state.loaded.coerceIn(0, total)

    val unknown
        get() = !ready && expected == 0L && (state.total ?: 0) == 0L
}

internal data class MapLoadingIssue(
    val key: String,
    val title: String,
    val message: String,
    val stage: String,
    val modelIds: Set<String> = emptySet(),
    val models: List<MapModel> = emptyList(),
    val kind: String? = null,
    val url: String? = null,
    val status: Int? = null,
    val attempt: Int = 0,
    val retryable: Boolean = false,
)

internal data class MapLoadingReport(
    val files: List<MapLoadingFile>,
    val issues: List<MapLoadingIssue>,
    val absent: Int = 0,
) {
    val total
        get() = files.size + absent

    val ready
        get() = files.count { it.ready }

    val remaining
        get() = total - ready

    val unknown
        get() = files.any { it.unknown } || absent > 0

    val totalBytes
        get() = files.sumOf { it.total }

    val loadedBytes
        get() = files.sumOf { it.loaded }
}

internal data class MapLoadingSession(
    val files: Map<String, MapLoadingFile> = emptyMap(),
    val active: Boolean = false,
)

/** A new batch starts from its pending files, rather than counting historical cache hits. */
internal fun mapLoadingSession(
    previous: MapLoadingSession,
    report: MapLoadingReport,
): Pair<MapLoadingSession, MapLoadingReport> {
    val pending = report.files.any { !it.ready } || report.absent > 0
    val start = if (!previous.active && pending) emptyMap() else previous.files
    val planned = report.files.map { it.state.url }.toSet()
    val files = start.filter { (url, file) -> url in planned || file.ready }.toMutableMap()
    for (file in report.files) if (!file.ready || file.state.url in files)
        files[file.state.url] = file
    val next = MapLoadingSession(files, files.values.any { !it.ready } || report.absent > 0)
    return next to report.copy(files = files.values.toList())
}

internal fun mapLoadingPath(url: String): String = runCatching {
    URI(url).rawPath
}
    .getOrNull()
    .orEmpty()
    .ifBlank { url.substringBefore('?').substringBefore('#') }

internal fun mapLoadingReport(
    document: JsonObject,
    state: MapEditorState,
    transfers: Map<String, MapDownload>,
    scene: MapSceneLoadState,
    sceneError: String? = null,
): MapLoadingReport {
    val ids =
        (document.rows("tiles") + document.rows("objects"))
            .map { it.string("modelId") }
            .filter(String::isNotBlank)
            .toSet()
    val used = state.models.filter { it.uuid in ids }
    val images = document.rows("decals").map { it.string("imageUrl") }.toSet()
    val kinds = linkedMapOf<String, String>()
    val owners = mutableMapOf<String, MutableList<MapModel>>()
    for (model in used) for ((kind, url) in
        listOf(
            "render" to model.renderUrl,
            "lod" to model.lodUrl,
            "shadow" to model.raw.string("shadowUrl"),
        )) {
        if (url.isBlank()) continue
        kinds.putIfAbsent(url, kind)
        owners.getOrPut(url) { mutableListOf() }.let { if (model !in it) it += model }
    }
    val records =
        transfers +
            scene.failures
                .filterKeys { it !in transfers }
                .mapValues { (url, failure) ->
                    MapDownload(
                        url,
                        MapDownloadPhase.Failed,
                        attempt = failure.attempt,
                        error = failure.message,
                        httpStatus = failure.status,
                        total = failure.total,
                    )
                }
    val files =
        records.values
            .mapNotNull { download ->
                val kind =
                    if (download.url == "/api/maps/models") "catalogue"
                    else
                        kinds[download.url]
                            ?: if (download.url in images) "other" else return@mapNotNull null
                val models = owners[download.url].orEmpty()
                val expected =
                    models.maxOfOrNull {
                        (it.raw["assetBytes"] as? JsonObject)?.number(kind)?.toLong() ?: 0
                    } ?: 0L
                val failure = scene.failures[download.url]
                val phase =
                    if (failure != null) {
                        if (!failure.retrying) MapDownloadPhase.Failed
                        else if (download.url !in scene.pendingUrls) MapDownloadPhase.Retrying
                        else if (
                            download.phase in
                                setOf(
                                    MapDownloadPhase.Loading,
                                    MapDownloadPhase.Queued,
                                    MapDownloadPhase.Processing,
                                )
                        )
                            download.phase
                        else MapDownloadPhase.Processing
                    } else if (
                        download.phase == MapDownloadPhase.Ready &&
                            download.url in scene.pendingUrls
                    )
                        MapDownloadPhase.Processing
                    else download.phase
                MapLoadingFile(
                    download.copy(
                        phase = phase,
                        error = failure?.message ?: download.error,
                        attempt = maxOf(download.attempt, failure?.attempt ?: 0),
                        httpStatus = failure?.status ?: download.httpStatus,
                        total = maxOf(download.total ?: 0, failure?.total ?: 0).takeIf { it > 0 },
                    ),
                    kind,
                    models,
                    expected,
                    failure?.stage ?: if (kind == "catalogue") "catalogue" else "download",
                )
            }
            .toMutableList()
    if (state.modelRefreshing && files.none { it.kind == "catalogue" })
        files += MapLoadingFile(MapDownload("/api/maps/models"), "catalogue")
    val issues =
        files
            .mapNotNull { file ->
                val error = file.state.error ?: return@mapNotNull null
                val missing = file.kind != "catalogue" && file.state.httpStatus in setOf(404, 410)
                MapLoadingIssue(
                    "${file.stage}:${file.state.url}",
                    if (missing) "Файл модели отсутствует" else "Ресурс не удалось загрузить",
                    mapLoadMessage(error),
                    file.stage,
                    file.models.map { it.uuid }.toSet(),
                    file.models,
                    file.kind,
                    file.state.url,
                    file.state.httpStatus,
                    file.state.attempt,
                    file.state.phase != MapDownloadPhase.Failed,
                )
            }
            .toMutableList()
    if (state.modelError != null && issues.none { it.stage == "catalogue" })
        issues +=
            MapLoadingIssue(
                "catalogue",
                "Не удалось получить каталог",
                mapLoadMessage(state.modelError),
                "catalogue",
                ids,
                kind = "catalogue",
                url = "/api/maps/models",
            )
    val missing = if (state.modelsFresh) ids - state.models.map { it.uuid }.toSet() else emptySet()
    if (missing.isNotEmpty())
        issues +=
            MapLoadingIssue(
                "model-missing:${missing.sorted()}",
                "Модель отсутствует в каталоге",
                "Модели отсутствуют в успешно загруженном каталоге",
                "catalogue",
                missing,
            )
    val noFile = used.filter { it.renderUrl.isBlank() }
    for (model in noFile) issues +=
        MapLoadingIssue(
            "file-missing:${model.uuid}",
            "Файл модели не задан",
            "У модели не задан файл для отображения",
            "download",
            setOf(model.uuid),
            listOf(model),
            "render",
        )
    if (sceneError != null && issues.isEmpty())
        issues +=
            MapLoadingIssue(
                "scene:$sceneError",
                "Не удалось подготовить сцену",
                mapLoadMessage(sceneError),
                "scene",
                ids,
            )
    return MapLoadingReport(files, issues, missing.size + noFile.size)
}
