package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.ui.designsystem.ShareSkeletonBlock
import ru.dndshare.client.ui.designsystem.WebPalette

@Composable
internal fun MapSceneView(
    document: JsonObject,
    models: List<MapModel>,
    cache: MapAssetCache,
    selected: Set<MapEntityRef>,
    orbit: Boolean,
    tap: (MapPointer) -> Unit,
    drag: (MapPointer, Boolean) -> Unit,
    cancel: () -> Unit,
    renderer: (FilamentMapScene?) -> Unit,
    status: (Int, String?) -> Unit,
    initialCamera: MapCamera? = null,
    active: Boolean = true,
    catalogueLoading: Boolean = false,
    catalogueError: String? = null,
    placing: Boolean = false,
    options: MapSceneOptions = MapSceneOptions(),
    rectangle: Boolean = false,
    selection: (Offset, Offset, Boolean) -> Unit = { _, _, _ -> },
    key: (android.view.KeyEvent) -> Boolean = { false },
) {
    var scene by remember { mutableStateOf<FilamentMapScene?>(null) }
    var touch by remember { mutableStateOf<MapTouchController?>(null) }
    var drawn by remember { mutableStateOf(false) }
    var firstFrameError by remember { mutableStateOf<String?>(null) }
    val onSelection by rememberUpdatedState(selection)
    val onKey by rememberUpdatedState(key)
    val onTap by rememberUpdatedState(tap)
    val onDrag by rememberUpdatedState(drag)
    val onCancel by rememberUpdatedState(cancel)
    val onStatus by rememberUpdatedState(status)
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    Box(Modifier.fillMaxSize()) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { context ->
                MapSurfaceView(context).apply {
                    contentDescription =
                        "Поле карты. Один палец — перемещение, два — масштаб и поворот, удержание — перенос элемента."
                    isFocusableInTouchMode = true
                    val created =
                        FilamentMapScene(this, cache) { count, error ->
                            drawn = scene?.hasMapFrame == true
                            firstFrameError = error
                            onStatus(count, error)
                        }
                    scene = created
                    renderer(created)
                    val pointer =
                        MapTouchController(
                            this,
                            created,
                            { p -> onTap(p) },
                            { p, end -> onDrag(p, end) },
                            { onCancel() },
                            {},
                            { a, b, end -> onSelection(a, b, end) },
                        )
                    touch = pointer
                    activate = pointer::click
                    setOnTouchListener { _, event -> pointer.event(event) }
                    setOnGenericMotionListener { _, event -> pointer.generic(event) }
                    setOnHoverListener { _, event -> pointer.hover(event) }
                    setOnKeyListener { _, _, event -> onKey(event) }
                    addOnLayoutChangeListener {
                        _,
                        left,
                        top,
                        right,
                        bottom,
                        oldLeft,
                        oldTop,
                        oldRight,
                        oldBottom ->
                        if (oldRight - oldLeft == 0 || oldBottom - oldTop == 0) {
                            created.camera(
                                initialCamera
                                    ?: created
                                        .camera()
                                        .fit(
                                            document.number("width"),
                                            document.number("height"),
                                            right - left,
                                            bottom - top,
                                        )
                            )
                        }
                    }
                }
            },
            update = { view ->
                view.contentDescription =
                    if (drawn)
                        "Поле карты. Готово. Один палец — перемещение, два — масштаб и поворот, удержание — перенос элемента."
                    else "Поле карты. Открываем карту…"
            },
            onRelease = { view ->
                view.activate = null
                view.setOnTouchListener(null)
                view.setOnGenericMotionListener(null)
                view.setOnHoverListener(null)
                view.setOnKeyListener(null)
                touch?.cancel()
                touch = null
                scene?.close()
                scene = null
                renderer(null)
            },
        )
        if (!drawn) {
            if (firstFrameError == null && catalogueError == null)
                ShareSkeletonBlock(Modifier.fillMaxSize())
            else
                Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                    Text(
                        (catalogueError ?: firstFrameError).orEmpty(),
                        color = WebPalette.TextMuted,
                    )
                }
        }
    }
    LaunchedEffect(scene, options, selected) { scene?.options(options.copy(selected = selected)) }
    LaunchedEffect(scene, document, models, catalogueLoading) {
        if (catalogueLoading) return@LaunchedEffect
        scene?.let {
            runCatching { it.update(document, models) }.onFailure { onStatus(0, it.message) }
        }
    }
    SideEffect {
        touch?.orbit = orbit
        touch?.rectangle = rectangle
        touch?.placing = placing
    }
    DisposableEffect(lifecycle, scene, active) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) {
                touch?.cancel()
                scene?.foreground(false)
            }
            if (event == Lifecycle.Event.ON_START) scene?.foreground(active)
        }
        lifecycle.addObserver(observer)
        if (!active) touch?.cancel()
        scene?.foreground(active && lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED))
        onDispose { lifecycle.removeObserver(observer) }
    }
}
