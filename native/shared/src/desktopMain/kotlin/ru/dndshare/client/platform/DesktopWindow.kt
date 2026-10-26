package ru.dndshare.client.platform

import com.sun.jna.Native
import com.sun.jna.Pointer
import com.sun.jna.platform.win32.WinDef.HWND
import com.sun.jna.ptr.IntByReference
import com.sun.jna.win32.StdCallLibrary
import java.awt.Window

internal interface DwmApi : StdCallLibrary {
    fun DwmSetWindowAttribute(window: HWND, attribute: Int, value: Pointer, size: Int): Int
}

// Use the same dark appearance for the Windows frame and Compose content.
fun darkDesktopFrame(window: Window) {
    if (!window.isDisplayable) return
    runCatching {
        val dwm = Native.load("dwmapi", DwmApi::class.java)
        val handle = HWND(Native.getComponentPointer(window))
        dwm.DwmSetWindowAttribute(handle, 20, IntByReference(1).pointer, 4)
        dwm.DwmSetWindowAttribute(handle, 35, IntByReference(0x00191211).pointer, 4)
        dwm.DwmSetWindowAttribute(handle, 36, IntByReference(0x00F5F0EE).pointer, 4)
    }
}
