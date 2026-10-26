package ru.dndshare.client.desktop

import androidx.compose.runtime.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState
import java.awt.Dimension
import java.awt.event.WindowAdapter
import java.awt.event.WindowEvent
import ru.dndshare.client.app.AppController
import ru.dndshare.client.network.ApiClient
import ru.dndshare.client.platform.DesktopPlatform
import ru.dndshare.client.platform.darkDesktopFrame
import ru.dndshare.client.ui.DndShareApp

fun main() = application {
    val controller = remember {
        val platform = DesktopPlatform("https://dndshare.ru")
        AppController(platform, ApiClient("https://dndshare.ru", platform))
    }
    Window(onCloseRequest = { controller.close(); exitApplication() }, title = "DnD Share",
        state = rememberWindowState(width = 1440.dp, height = 940.dp)) {
        DisposableEffect(window) {
            window.minimumSize = Dimension(360, 480)
            darkDesktopFrame(window)
            val listener = object : WindowAdapter() {
                override fun windowOpened(e: WindowEvent) = darkDesktopFrame(window)
                override fun windowActivated(e: WindowEvent) = controller.foreground(true)
                override fun windowDeactivated(e: WindowEvent) = controller.foreground(false)
            }
            window.addWindowListener(listener)
            controller.foreground(true)
            onDispose { window.removeWindowListener(listener); controller.close() }
        }
        DndShareApp(controller)
    }
}
