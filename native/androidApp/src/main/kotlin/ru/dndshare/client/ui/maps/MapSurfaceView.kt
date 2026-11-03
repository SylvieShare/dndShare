package ru.dndshare.client.ui.maps

import android.content.Context
import android.view.SurfaceView

/** Accessibility click activates the center; a physical tap supplies its actual coordinates. */
internal class MapSurfaceView(context: Context) : SurfaceView(context) {
    var activate: (() -> Unit)? = null
    var deactivate: (() -> Unit)? = null

    override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
        super.onWindowFocusChanged(hasWindowFocus)
        if (!hasWindowFocus) deactivate?.invoke()
    }

    override fun performClick(): Boolean {
        super.performClick()
        activate?.invoke()
        return true
    }
}
