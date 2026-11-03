package ru.dndshare.client.maps.rendering

import android.view.SurfaceView
import android.view.View
import com.google.android.filament.android.UiHelper

/** Window coordinates stay physical; only the Surface buffer and renderer viewport shrink. */
internal class MapSurfaceResolution(private val view: SurfaceView, private val helper: UiHelper) :
    AutoCloseable {
    @Volatile
    var width = 0
        private set

    @Volatile
    var height = 0
        private set

    @Volatile
    var bufferWidth = 0
        private set

    @Volatile
    var bufferHeight = 0
        private set

    @Volatile
    var revision = 0L
        private set

    val scaleX
        get() = if (width > 0 && bufferWidth > 0) bufferWidth.toDouble() / width else 1.0

    val scaleY
        get() = if (height > 0 && bufferHeight > 0) bufferHeight.toDouble() / height else 1.0

    private val listener = View.OnLayoutChangeListener { _, left, top, right, bottom, _, _, _, _ ->
        layout(right - left, bottom - top)
    }

    init {
        view.addOnLayoutChangeListener(listener)
        layout(view.width, view.height)
    }

    private fun layout(width: Int, height: Int) {
        if (width <= 0 || height <= 0) return
        if (this.width != width || this.height != height) revision++
        this.width = width
        this.height = height
        val size = mapRenderSize(width, height, view.resources.displayMetrics.density.toDouble())
        if (helper.desiredWidth != size.width || helper.desiredHeight != size.height)
            helper.setDesiredSize(size.width, size.height)
    }

    fun buffer(width: Int, height: Int) {
        if (this.width <= 0) this.width = view.width.takeIf { it > 0 } ?: width
        if (this.height <= 0) this.height = view.height.takeIf { it > 0 } ?: height
        bufferWidth = width
        bufferHeight = height
        revision++
    }

    fun render(camera: MapCamera) = camera.copy(pixels = camera.pixels * scaleX)

    override fun close() {
        view.removeOnLayoutChangeListener(listener)
    }
}
