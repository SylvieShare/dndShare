package ru.dndshare.client.ui.maps

import android.os.Handler
import android.os.Looper
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import kotlin.math.*
import ru.dndshare.client.maps.MapPose
import ru.dndshare.client.maps.rendering.FilamentMapScene
import ru.dndshare.client.maps.rendering.MapCamera

/** A second pointer cancels editing before starting camera navigation. */
internal class MapTouchController(
    private val host: View,
    private val scene: FilamentMapScene,
    private val tap: (String?, MapPose) -> Unit,
    private val drag: (String, MapPose, Boolean) -> Unit,
    private val cancelEdit: () -> Unit,
    private val changed: () -> Unit,
) {
    var orbit = false
    private val handler = Handler(Looper.getMainLooper())
    private var pointer = -1
    private var startX = 0f
    private var startY = 0f
    private var lastX = 0f
    private var lastY = 0f
    private var moved = false
    private var holding = false
    private var hit: String? = null
    private var sequence = 0L
    private var initial = MapCamera()
    private var pair: PairFrame? = null
    private var tapPoint: Pair<Float, Float>? = null
    private val threshold = 5 * host.resources.displayMetrics.density
    private val hold = Runnable {
        if (!moved && pair == null && hit != null && !orbit) {
            holding = true
            host.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
            drag(
                requireNotNull(hit),
                scene
                    .camera()
                    .world(startX.toDouble(), startY.toDouble(), scene.width, scene.height),
                false,
            )
        }
    }

    fun event(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
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
                handler.postDelayed(hold, 500)
                host.parent?.requestDisallowInterceptTouchEvent(true)
            }
            MotionEvent.ACTION_POINTER_DOWN -> {
                handler.removeCallbacks(hold)
                if (holding) cancelEdit()
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
                if (holding)
                    hit?.let {
                        drag(
                            it,
                            scene
                                .camera()
                                .world(x.toDouble(), y.toDouble(), scene.width, scene.height),
                            false,
                        )
                    }
                else if (moved) {
                    if (orbit)
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
                if (holding) hit?.let { drag(it, world, true) }
                else if (!moved && pair == null) {
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

    fun cancel() {
        sequence++
        handler.removeCallbacks(hold)
        if (holding) cancelEdit()
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
        scene.pick(point.first, point.second) { if (serial == sequence) tap(it, world) }
    }

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
