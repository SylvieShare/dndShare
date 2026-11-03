package ru.dndshare.client

import android.graphics.Bitmap
import android.os.Build
import android.os.ParcelFileDescriptor
import androidx.test.platform.app.InstrumentationRegistry

/** Shell-owned diagnostics survive AGP's automatic emulator uninstall. */
internal fun exportMapTestImage(name: String, image: Bitmap) {
    require(name.matches(Regex("[a-z0-9-]+\\.png")))
    if (Build.VERSION.SDK_INT < 31) return
    val automation = InstrumentationRegistry.getInstrumentation().uiAutomation
    ParcelFileDescriptor.AutoCloseInputStream(
            automation.executeShellCommand("mkdir -p /sdcard/Download/dndshare-map-review")
        )
        .use { it.readBytes() }
    val pipes =
        automation.executeShellCommandRw("sh -c cat>/sdcard/Download/dndshare-map-review/$name")
    try {
        ParcelFileDescriptor.AutoCloseOutputStream(pipes[1]).use { out ->
            check(image.compress(Bitmap.CompressFormat.PNG, 100, out))
        }
        ParcelFileDescriptor.AutoCloseInputStream(pipes[0]).use { it.readBytes() }
    } finally {
        pipes.forEach { runCatching { it.close() } }
    }
}
