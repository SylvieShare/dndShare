package ru.dndshare.client.ui.maps

import android.content.Context
import android.view.SurfaceView

/** Accessibility click activates the center; a physical tap supplies its actual coordinates. */
internal class MapSurfaceView(context: Context) : SurfaceView(context) {
    var activate: (() -> Unit)? = null

    override fun performClick(): Boolean {
        super.performClick()
        activate?.invoke()
        return true
    }
}
