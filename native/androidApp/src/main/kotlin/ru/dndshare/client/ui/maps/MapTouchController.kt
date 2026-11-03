package ru.dndshare.client.ui.maps

import android.os.Handler
import android.os.Looper
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import androidx.compose.ui.geometry.Offset
import kotlin.math.*
import ru.dndshare.client.maps.MapEntityRef
import ru.dndshare.client.maps.rendering.FilamentMapScene
import ru.dndshare.client.maps.rendering.MapCamera

/** A second pointer cancels editing before starting camera navigation. */
internal class MapTouchController(
    private val host: View,
    private val scene: FilamentMapScene,
    private val tap: (MapPointer) -> Unit,
    private val drag: (MapPointer, Boolean) -> Unit,
    private val cancelEdit: () -> Unit,
    private val changed: () -> Unit,
    private val selection: (Offset, Offset, Boolean) -> Unit = { _, _, _ -> },
) {
    var orbit = false
    var rectangle = false
    var placing = false
    private var selecting = false
    private var mouse = false
    private var right = false
    private val handler = Handler(Looper.getMainLooper())
    private var pointer = -1
    private var startX = 0f
    private var startY = 0f
    private var lastX = 0f
    private var lastY = 0f
    private var moved = false
    private var holding = false
    private var hit: MapEntityRef? = null
    private var sequence = 0L
    private var initial = MapCamera()
    private var pair: PairFrame? = null
    private var tapPoint: Pair<Float, Float>? = null
    private val threshold = 5 * host.resources.displayMetrics.density
    private val hold = Runnable {
        if (!moved && pair == null && hit != null && !orbit && !placing) {
            holding = true
            host.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
            drag(pointerAt(startX, startY, hit), false)
        }
    }

    fun event(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                host.requestFocus()
                selecting =
                    rectangle || (event.metaState and android.view.KeyEvent.META_SHIFT_ON != 0)
                mouse = event.getToolType(0) == MotionEvent.TOOL_TYPE_MOUSE
                right = mouse && event.buttonState and MotionEvent.BUTTON_SECONDARY != 0
                sequence++
                pointer = event.getPointerId(0)
                startX = event.x
                startY = event.y
                lastX = event.x
                lastY = event.y
                moved = false
                holding = false
                hit = null
                pair = null
                initial = scene.camera()
                val serial = sequence
                scene.pick(event.x, event.y) { if (serial == sequence && pointer >= 0) hit = it }
                if (!selecting && !right && !placing) handler.postDelayed(hold, 500)
                if (placing && !selecting) drag(pointerAt(startX, startY, null), false)
                host.parent?.requestDisallowInterceptTouchEvent(true)
            }
            MotionEvent.ACTION_POINTER_DOWN -> {
                handler.removeCallbacks(hold)
                if (holding || selecting || placing) cancelEdit()
                selecting = false
                holding = false
                moved = true
                sequence++
                pair = if (event.pointerCount >= 2) frame(event) else null
            }
            MotionEvent.ACTION_MOVE -> {
                if (event.pointerCount >= 2) {
                    val now = frame(event)
                    val before = pair ?: now
                    var camera =
                        scene
                            .camera()
                            .pan((now.x - before.x).toDouble(), (now.y - before.y).toDouble())
                    camera =
                        camera.zoom(
                            (now.distance / before.distance.coerceAtLeast(1f)).toDouble(),
                            now.x.toDouble(),
                            now.y.toDouble(),
                            scene.width,
                            scene.height,
                        )
                    val delta = ((now.angle - before.angle + 540) % 360) - 180
                    scene.camera(camera.copy(azimuth = (camera.azimuth + delta) % 360))
                    pair = now
                    changed()
                    return true
                }
                if (pair != null) return true // Finish the multi-touch gesture without a stray tap.
                val index = event.findPointerIndex(pointer)
                if (index < 0) return true
                val x = event.getX(index)
                val y = event.getY(index)
                if (hypot(x - startX, y - startY) >= threshold) {
                    moved = true
                    handler.removeCallbacks(hold)
                }
                if (selecting) {
                    selection(Offset(startX, startY), Offset(x, y), false)
                    return true
                }
                if (placing) {
                    if (moved) drag(pointerAt(x, y, hit), false)
                    return true
                }
                if (mouse && !right && moved && hit != null && !holding) {
                    holding = true
                    drag(pointerAt(startX, startY, hit), false)
                }
                if (holding) hit?.let { drag(pointerAt(x, y, it), false) }
                else if (moved) {
                    if (orbit || right)
                        scene.camera(
                            initial.copy(
                                azimuth =
                                    initial.azimuth +
                                        (x - startX) * .3 / host.resources.displayMetrics.density,
                                tilt =
                                    (initial.tilt +
                                            (y - startY) * .2 /
                                                host.resources.displayMetrics.density)
                                        .coerceIn(20.0, 90.0),
                            )
                        )
                    else
                        scene.camera(
                            scene.camera().pan((x - lastX).toDouble(), (y - lastY).toDouble())
                        )
                    changed()
                }
                lastX = x
                lastY = y
            }
            MotionEvent.ACTION_POINTER_UP -> {
                handler.removeCallbacks(hold)
                moved = true
                sequence++
            }
            MotionEvent.ACTION_UP -> {
                handler.removeCallbacks(hold)
                val world =
                    scene
                        .camera()
                        .world(event.x.toDouble(), event.y.toDouble(), scene.width, scene.height)
                if (selecting) {
                    selection(Offset(startX, startY), Offset(event.x, event.y), true)
                    selecting = false
                } else if (placing && moved && pair == null)
                    drag(MapPointer(hit, world, event.x, event.y), true)
                else if (holding) hit?.let { drag(MapPointer(it, world, event.x, event.y), true) }
                else if (!moved && pair == null && !right) {
                    tapPoint = event.x to event.y
                    host.performClick()
                }
                pointer = -1
                holding = false
                pair = null
                host.parent?.requestDisallowInterceptTouchEvent(false)
            }
            MotionEvent.ACTION_CANCEL -> cancel()
        }
        return true
    }

    fun hover(event: MotionEvent): Boolean {
        if (!placing) return false
        if (
            event.actionMasked == MotionEvent.ACTION_HOVER_MOVE ||
                event.actionMasked == MotionEvent.ACTION_HOVER_ENTER
        ) {
            drag(pointerAt(event.x, event.y, null), false)
            return true
        }
        if (event.actionMasked == MotionEvent.ACTION_HOVER_EXIT) {
            cancelEdit()
            return true
        }
        return false
    }

    fun generic(event: MotionEvent): Boolean {
        if (event.actionMasked != MotionEvent.ACTION_SCROLL) return false
        scene.camera(
            scene
                .camera()
                .zoom(
                    exp(event.getAxisValue(MotionEvent.AXIS_VSCROLL) * .15),
                    event.x.toDouble(),
                    event.y.toDouble(),
                    scene.width,
                    scene.height,
                )
        )
        changed()
        return true
    }

    fun cancel() {
        sequence++
        handler.removeCallbacks(hold)
        if (holding || selecting || placing) cancelEdit()
        selecting = false
        holding = false
        pointer = -1
        pair = null
        host.parent?.requestDisallowInterceptTouchEvent(false)
    }

    fun click() {
        val point = tapPoint ?: (host.width / 2f to host.height / 2f)
        tapPoint = null
        val serial = ++sequence
        val world =
            scene
                .camera()
                .world(point.first.toDouble(), point.second.toDouble(), scene.width, scene.height)
        scene.pick(point.first, point.second) {
            if (serial == sequence) tap(MapPointer(it, world, point.first, point.second))
        }
    }

    private fun pointerAt(x: Float, y: Float, ref: MapEntityRef?) =
        MapPointer(
            ref,
            scene.camera().world(x.toDouble(), y.toDouble(), scene.width, scene.height),
            x,
            y,
        )

    private fun frame(event: MotionEvent): PairFrame {
        val dx = event.getX(1) - event.getX(0)
        val dy = event.getY(1) - event.getY(0)
        return PairFrame(
            (event.getX(0) + event.getX(1)) / 2,
            (event.getY(0) + event.getY(1)) / 2,
            hypot(dx, dy),
            Math.toDegrees(atan2(dy.toDouble(), dx.toDouble())).toFloat(),
        )
    }

    private data class PairFrame(val x: Float, val y: Float, val distance: Float, val angle: Float)
}
