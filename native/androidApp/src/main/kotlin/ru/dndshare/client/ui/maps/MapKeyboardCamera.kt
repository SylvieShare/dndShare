package ru.dndshare.client.ui.maps

import android.view.Choreographer
import android.view.KeyEvent
import ru.dndshare.client.maps.rendering.*

/** UI frame clock drives camera state; Filament commands remain on its renderer looper. */
internal class MapKeyboardCamera(private val scene: () -> FilamentMapScene?) {
    private val motion = MapCameraPanMotion()
    private var clock: Choreographer? = null
    private var scheduled = false
    private var last = 0L
    private val callback = Choreographer.FrameCallback { time ->
        scheduled = false
        val renderer = scene()
        if (renderer == null) stop()
        else {
            val dt = if (last == 0L) .016 else (time - last) / 1_000_000_000.0
            last = time
            val (x, y) = motion.advance(dt)
            if (x != 0.0 || y != 0.0)
                renderer.camera(renderer.camera().pan(-x * renderer.density, -y * renderer.density))
            if (motion.moving) schedule() else last = 0L
        }
    }

    fun key(event: KeyEvent): Boolean {
        val direction =
            when (event.keyCode) {
                KeyEvent.KEYCODE_DPAD_LEFT -> MapPanDirection.Left
                KeyEvent.KEYCODE_DPAD_RIGHT -> MapPanDirection.Right
                KeyEvent.KEYCODE_DPAD_UP -> MapPanDirection.Up
                KeyEvent.KEYCODE_DPAD_DOWN -> MapPanDirection.Down
                else -> return false
            }
        when (event.action) {
            KeyEvent.ACTION_DOWN -> {
                motion.down(direction)
                schedule()
            }
            KeyEvent.ACTION_UP -> {
                motion.up(direction)
                if (motion.moving) schedule()
            }
            else -> return false
        }
        return true
    }

    private fun schedule() {
        if (scheduled) return
        val choreographer = clock ?: Choreographer.getInstance().also { clock = it }
        scheduled = true
        choreographer.postFrameCallback(callback)
    }

    fun stop() {
        clock?.removeFrameCallback(callback)
        scheduled = false
        last = 0L
        motion.stop()
    }
}
