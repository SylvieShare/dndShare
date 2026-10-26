package ru.dndshare.client.ui

import androidx.compose.runtime.*
import java.awt.KeyboardFocusManager
import java.awt.KeyEventDispatcher
import java.awt.event.KeyEvent

@Composable
actual fun PlatformBackHandler(enabled: Boolean, onBack: () -> Unit) {
    val currentBack by rememberUpdatedState(onBack)
    DisposableEffect(enabled) {
        val manager = KeyboardFocusManager.getCurrentKeyboardFocusManager()
        val handler = KeyEventDispatcher { event ->
            if (enabled && event.id == KeyEvent.KEY_PRESSED && event.keyCode == KeyEvent.VK_ESCAPE) {
                currentBack()
                true
            } else false
        }
        manager.addKeyEventDispatcher(handler)
        onDispose { manager.removeKeyEventDispatcher(handler) }
    }
}
