package ru.dndshare.client.ui.maps

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collectLatest
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

/** Persist navigation after it settles; gestures never write the document on every frame. */
internal class MapViewportSession(
    private val controller: MapEditorController,
    private val scope: CoroutineScope,
) {
    private var observation: Job? = null
    private var last: MapCamera? = null

    fun attach(scene: FilamentMapScene?) {
        observation?.cancel()
        if (scene == null) return
        observation = scope.launch {
            scene.cameraState.collectLatest { camera ->
                last = camera
                delay(250)
                flush()
            }
        }
    }

    fun flush() {
        val camera = last ?: return
        controller.ui { it.copy(camera = camera) }
    }

    fun close() {
        flush()
        observation?.cancel()
    }
}
