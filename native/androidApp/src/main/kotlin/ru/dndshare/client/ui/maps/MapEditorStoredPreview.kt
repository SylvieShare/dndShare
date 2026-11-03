package ru.dndshare.client.ui.maps

import androidx.compose.runtime.*
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.*
import ru.dndshare.client.maps.*

@Composable
internal fun MapEditorStoredPreview(workspace: MapEditorWorkspace, previews: MapStoredPreviews) {
    val state = workspace.state
    val map = state.map
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(
        map?.id,
        map?.revision,
        map?.previewSignature,
        map?.previewUrl,
        map?.previewStale,
        state.work?.dirty,
        workspace.preview != null,
        workspace.ui.tool,
        state.modelLoading,
        state.saving,
        state.conflict,
        lifecycle,
    ) {
        if (
            map == null ||
                !map.owned ||
                !map.previewUrl.isNullOrBlank() && !map.previewStale ||
                state.work?.dirty == true ||
                state.modelLoading ||
                state.saving ||
                state.conflict
        )
            return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            delay(8000)
            try {
                workspace.controller.attachPreview(previews.ensure(map), map)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                /* Retry on the next save or library visit; editing remains available. */
            }
            awaitCancellation()
        }
    }
}
