package ru.dndshare.client.ui.maps

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import coil3.ImageLoader
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.MapAssetCache
import ru.dndshare.client.maps.rendering.MapSnapshotQueue
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapEditorScreen(
    id: String,
    api: MapsApi,
    store: MapWorkspaceStore,
    cache: MapAssetCache,
    images: ImageLoader,
    format: LayoutFormat,
    close: () -> Unit,
    replace: (String) -> Unit = { close() },
    admin: Boolean = false,
    snapshots: MapSnapshotQueue? = null,
    previews: MapStoredPreviews? = null,
) {
    val context = LocalContext.current.applicationContext
    val queue = snapshots ?: remember(cache) { MapSnapshotQueue(context, cache) }
    val publisher = previews ?: remember(api, queue) { MapStoredPreviews(api, queue) }
    DisposableEffect(queue) { onDispose { if (snapshots == null) queue.close() } }
    val controller = remember(id) { MapEditorController(api, store) }
    val scope = rememberCoroutineScope()
    val workspace =
        remember(controller) { MapEditorWorkspace(controller, scope, format, id, api, queue) }
    val inputs = remember(id) { ShareFormInputs() }
    var leaving by remember { mutableStateOf(false) }
    var recovery by remember { mutableStateOf(false) }
    SideEffect { workspace.format = format }
    fun exit() {
        inputs.flush()
        if (leaving) return
        leaving = true
        scope.launch {
            try {
                if (controller.flush()) close() else recovery = true
            } finally {
                leaving = false
            }
        }
    }
    BackHandler {
        inputs.flush()
        if (!workspace.back()) exit()
    }
    LaunchedEffect(id) { controller.open(id) }
    DisposableEffect(controller) {
        onDispose {
            inputs.flush()
            workspace.close()
            controller.close()
        }
    }
    CompositionLocalProvider(LocalShareFormInputs provides inputs) {
        MapEditorStoredPreview(workspace, publisher)
        key(id) { MapEditorLayout(workspace, cache, images, admin, leaving, ::exit) }
        if (recovery)
            MapPersistenceDialog(
                workspace.state,
                dismiss = { recovery = false },
                library = {
                    recovery = false
                    close()
                },
                retry = {
                    scope.launch {
                        if (controller.flush()) {
                            recovery = false
                            close()
                        }
                    }
                },
                reload = controller::reload,
                saveCopy = {
                    scope.launch {
                        try {
                            val copy = controller.saveLocalCopy()
                            recovery = false
                            replace(copy.id)
                        } catch (cancelled: CancellationException) {
                            throw cancelled
                        } catch (_: Exception) {
                            /* The controller preserves and reports the draft. */
                        }
                    }
                },
            )
    }
}
