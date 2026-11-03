package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.ui.maps.*

class MapDownloadPresentationTest {
    private val url = "/api/maps/models/floor/render?signature=private"
    private val model = MapModel("F-floor", "floor", "Пол", renderUrl = url)
    private val document =
        newMapDocument()
            .with(
                "tiles",
                JsonArray(
                    listOf(
                        buildJsonObject {
                            put("id", "tile")
                            put("modelId", "floor")
                            put("x", 1)
                            put("y", 2)
                            put("level", 0)
                        }
                    )
                ),
            )
    private val state =
        MapEditorState(models = listOf(model), modelRefreshing = false, modelsFresh = true)

    @Test
    fun successfulBytesStayInProcessingUntilTheRendererHasPreparedThatExactUrl() {
        val transfer = MapDownload(url, MapDownloadPhase.Ready, loaded = 100, total = 100)
        val pending =
            mapLoadingReport(
                document,
                state,
                mapOf(url to transfer),
                MapSceneLoadState(pendingUrls = setOf(url)),
            )
        assertEquals(MapDownloadPhase.Processing, pending.files.single().state.phase)
        assertEquals(1, pending.remaining)
        val ready =
            mapLoadingReport(
                document,
                state,
                mapOf(url to transfer),
                MapSceneLoadState(readyUrls = setOf(url)),
            )
        assertEquals(0, ready.remaining)
        assertEquals(100L, ready.loadedBytes)
    }

    @Test
    fun onlyAFreshCatalogueCanConfirmMissingModelsAndDiagnosticsExcludeQueryParameters() {
        val cached = state.copy(models = emptyList(), modelsFresh = false)
        assertTrue(
            mapLoadingReport(document, cached, emptyMap(), MapSceneLoadState()).issues.isEmpty()
        )
        val absent =
            mapLoadingReport(
                document,
                cached.copy(modelsFresh = true),
                emptyMap(),
                MapSceneLoadState(),
            )
        assertEquals(setOf("floor"), absent.issues.single().modelIds)
        val failure =
            MapDownload(
                url,
                MapDownloadPhase.Failed,
                error = "Ошибка https://dndshare.ru/api/maps/models/floor/render?token=private",
                httpStatus = 404,
            )
        val issue =
            mapLoadingReport(document, state, mapOf(url to failure), MapSceneLoadState())
                .issues
                .single()
        assertEquals("Файл модели отсутствует", issue.title)
        assertFalse("private" in issue.message)
        assertEquals("/api/maps/models/floor/render", mapLoadingPath(requireNotNull(issue.url)))
    }

    @Test
    fun newBatchesCountPendingFilesWithoutAccumulatingHistoricalCacheHits() {
        fun file(name: String, phase: MapDownloadPhase) =
            MapLoadingFile(MapDownload(name, phase), "render")
        val (first, progress) =
            mapLoadingSession(
                MapLoadingSession(),
                MapLoadingReport(
                    listOf(
                        file("cached", MapDownloadPhase.Ready),
                        file("new", MapDownloadPhase.Loading),
                    ),
                    emptyList(),
                ),
            )
        assertEquals(1, progress.total)
        val (finished, _) =
            mapLoadingSession(
                first,
                MapLoadingReport(listOf(file("new", MapDownloadPhase.Ready)), emptyList()),
            )
        assertFalse(finished.active)
        val (_, next) =
            mapLoadingSession(
                finished,
                MapLoadingReport(
                    listOf(
                        file("new", MapDownloadPhase.Ready),
                        file("another", MapDownloadPhase.Loading),
                    ),
                    emptyList(),
                ),
            )
        assertEquals(1, next.total)
        assertEquals("another", next.files.single().state.url)
    }
}
