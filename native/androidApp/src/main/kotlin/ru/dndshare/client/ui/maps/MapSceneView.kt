package ru.dndshare.client.ui.maps

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
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
    placing: Boolean = false,
    options: MapSceneOptions = MapSceneOptions(),
    rectangle: Boolean = false,
    selection: (Offset, Offset, Boolean) -> Unit = { _, _, _ -> },
    key: (android.view.KeyEvent) -> Boolean = { false },
) {
    var scene by remember { mutableStateOf<FilamentMapScene?>(null) }
    var touch by remember { mutableStateOf<MapTouchController?>(null) }
    var cameraRevision by remember { mutableIntStateOf(0) }
    var ready by remember { mutableStateOf<Set<MapEntityRef>>(emptySet()) }
    var drawn by remember { mutableStateOf(false) }
    var firstFrameError by remember { mutableStateOf<String?>(null) }
    val onSelection by rememberUpdatedState(selection)
    val onKey by rememberUpdatedState(key)
    val onTap by rememberUpdatedState(tap)
    val onDrag by rememberUpdatedState(drag)
    val onCancel by rememberUpdatedState(cancel)
    val onStatus by rememberUpdatedState(status)
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val cameraPose = scene?.cameraState?.collectAsState()?.value
    val catalogue = remember(models) { models.associateBy { it.uuid } }
    val heights by
        produceState<Map<String, MapSupport>>(emptyMap(), document, catalogue) {
            value =
                withContext(Dispatchers.Default) {
                    runCatching { mapPlacements(document, catalogue) }.getOrDefault(emptyMap())
                }
        }
    val hidden =
        remember(document) {
            document
                .rows("areas")
                .filter { it.flag("hidden") }
                .flatMap { it.ids("tileIds") }
                .toSet()
        }
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
                            ready = scene?.readyRefs.orEmpty()
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
                            { cameraRevision++ },
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
                        cameraRevision++
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
            if (firstFrameError == null) ShareSkeletonBlock(Modifier.fillMaxSize())
            else
                Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                    Text(firstFrameError.orEmpty(), color = WebPalette.TextMuted)
                }
        }
        val current = scene
        val revision = cameraRevision
        Canvas(Modifier.fillMaxSize()) {
            if (current == null || revision < 0) return@Canvas
            document
                .rows("tiles")
                .filter {
                    MapEntityRef(MapEntityKind.Tile, it.string("id")) in selected ||
                        (it.string("id") !in hidden &&
                            MapEntityRef(MapEntityKind.Tile, it.string("id")) !in ready)
                }
                .forEach { tile ->
                    val model = catalogue[tile.string("modelId")] ?: return@forEach
                    val (width, height) = mapFootprint(tile, model)
                    val elevation = heights[tile.string("id")]?.elevation ?: 0.0
                    val points =
                        listOf(0 to 0, width to 0, width to height, 0 to height).map { (dx, dy) ->
                            (cameraPose ?: current.camera()).project(
                                MapPose(
                                    tile.number("x") + dx,
                                    tile.number("y") + dy,
                                    elevation + .02,
                                ),
                                size.width.toInt(),
                                size.height.toInt(),
                            )
                        }
                    val path =
                        Path().apply {
                            points.forEachIndexed { i, (x, y) ->
                                if (i == 0) moveTo(x, y) else lineTo(x, y)
                            }
                            close()
                        }
                    val pending = MapEntityRef(MapEntityKind.Tile, tile.string("id")) !in ready
                    drawPath(path, WebPalette.Accent.copy(alpha = if (pending) .3f else .18f))
                    drawPath(path, WebPalette.AccentSoft, style = Stroke(2f * density))
                    if (pending) {
                        val center =
                            Offset(
                                points.sumOf { it.first.toDouble() }.toFloat() / 4,
                                points.sumOf { it.second.toDouble() }.toFloat() / 4,
                            )
                        drawCircle(
                            WebPalette.AccentSoft,
                            7f * density,
                            center,
                            style = Stroke(2f * density),
                        )
                    }
                }
        }
    }
    LaunchedEffect(scene, options) { scene?.options(options) }
    LaunchedEffect(scene, document, models) {
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
