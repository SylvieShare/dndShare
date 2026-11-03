package ru.dndshare.client

import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.MapCamera
import ru.dndshare.client.model.WireJson

class MapOpeningTest {
    @Test
    fun backgroundOpeningPreservesAnUnsavedNavigationCommandWithFreshServerData() {
        val base = BattleMap(id = "map", name = "Старое", revision = 1)
        val initial =
            MapWork(
                key = "map",
                confirmed = base,
                localVersion = 5,
                ui = MapEditorUi(panel = "tiles"),
            )
        val navigating =
            initial.copy(
                localVersion = 6,
                ui =
                    MapEditorUi(
                        panel = "cameras",
                        camera = MapCamera(x = 3.0),
                        referenceOpen = true,
                    ),
            )
        val fresh =
            MapWork(
                key = "map",
                confirmed = base.copy(name = "Серверное", revision = 2),
                localVersion = 7,
                ui = initial.ui,
            )
        val merged = mergeOpenedMapWork(fresh, navigating)
        assertEquals("Серверное", merged.current.name)
        assertEquals(2, merged.current.revision)
        assertEquals(navigating.ui, merged.ui)
        assertTrue(merged.localVersion > fresh.localVersion)
        assertFalse(merged.dirty)
    }

    @Test
    fun newerPersistedNavigationFromThePreviousActivityWinsOverAnOlderRead() {
        val base = BattleMap(id = "map")
        val local =
            MapWork(
                key = "map",
                confirmed = base,
                localVersion = 2,
                ui = MapEditorUi(panel = "tiles"),
            )
        val newest = local.copy(localVersion = 8, ui = MapEditorUi(panel = "settings"))
        assertEquals(newest, mergeOpenedMapWork(newest, local))
    }

    @Test
    fun pendingDocumentEditsRemainBasedOnTheSameConfirmedRevision() {
        val base = BattleMap(id = "map", name = "База", revision = 1)
        val pending =
            MapWork(
                key = "map",
                confirmed = base,
                current = base.copy(name = "Моё"),
                localVersion = 8,
                ui = MapEditorUi(panel = "settings"),
            )
        val incoming =
            MapWork(
                key = "map",
                confirmed = base.copy(name = "Иное", revision = 2),
                localVersion = 7,
            )
        assertEquals(pending, mergeOpenedMapWork(incoming, pending))
    }

    @Test
    fun cameraPoseAndOpenReferenceRestoreFromTheLocalWorkspaceFormat() {
        val work =
            MapWork(
                ui =
                    MapEditorUi(
                        camera = MapCamera(x = 2.5, y = 7.0, azimuth = 170.0, pixels = 90.0),
                        referenceOpen = true,
                    )
            )
        assertEquals(
            work,
            WireJson.decodeFromString<MapWork>(WireJson.encodeToString(MapWork.serializer(), work)),
        )
    }
}
