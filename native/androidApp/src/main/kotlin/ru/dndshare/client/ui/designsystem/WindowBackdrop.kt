package ru.dndshare.client.ui.designsystem

import android.os.Build
import android.view.WindowManager
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogWindowProvider

internal class WindowBackdrops {
    val entries = mutableStateMapOf<Any, Dp>()
    val radius: Dp get() = entries.values.maxOrNull() ?: 0.dp
}

internal val LocalWindowBackdrops = staticCompositionLocalOf<WindowBackdrops?> { null }

/** App-content blur remains available even when the system disables cross-window blur. */
@Composable
internal fun RegisterWindowBackdrop(radius: Dp) {
    val host = LocalWindowBackdrops.current
    DisposableEffect(host, radius) {
        val token = Any()
        if (radius > 0.dp) host?.entries?.set(token, radius)
        onDispose { host?.entries?.remove(token) }
    }
}

/** The platform effect also softens another dialog beneath a nested editor. */
@Composable
internal fun ApplyWindowBackdrop(radius: Dp, dimAmount: Float?) {
    val view = LocalView.current
    val host = LocalWindowBackdrops.current
    // One app-hosted dialog already blurs the page. The platform pass is only
    // needed without a host, or to blur another native window beneath this one.
    val platformBlur = host == null || host.entries.size > 1
    val pixels = with(LocalDensity.current) { if (platformBlur) radius.roundToPx() else 0 }
    SideEffect {
        (view.parent as? DialogWindowProvider)?.window?.let { window ->
            if (dimAmount != null && window.attributes.dimAmount != dimAmount) window.setDimAmount(dimAmount)
            if (Build.VERSION.SDK_INT >= 31) {
                val attributes = window.attributes
                val blurFlag = WindowManager.LayoutParams.FLAG_BLUR_BEHIND
                val flags = if (pixels > 0) attributes.flags or blurFlag else attributes.flags and blurFlag.inv()
                if (attributes.flags != flags || attributes.blurBehindRadius != pixels) {
                    attributes.flags = flags
                    attributes.blurBehindRadius = pixels
                    window.attributes = attributes
                }
            }
        }
    }
}
