package ru.dndshare.client

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlin.test.*
import kotlinx.coroutines.runBlocking
import org.junit.Test
import org.junit.runner.RunWith
import ru.dndshare.client.ui.media.*

@RunWith(AndroidJUnit4::class)
class ImagePreparationTest {
    @Test
    fun invalidCropCoordinatesFailBeforeAllocatingAnOutput() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        for (ratio in listOf(0f, -1f, Float.NaN, Float.POSITIVE_INFINITY)) assertFailsWith<
            IllegalArgumentException
        > {
            cropStagedImage(context, "missing", ratio, 1f, 0f, 0f, false)
        }
    }

    @Test
    fun largeImageBecomesPrivateBoundedIconAndPortraitWithoutChangingSource() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val source = java.io.File(context.cacheDir, "crop-test.png")
        val bitmap = Bitmap.createBitmap(3000, 1500, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(android.graphics.Color.MAGENTA)
        source.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
        val before = source.readBytes()
        val staged = stageImage(context, Uri.fromFile(source))
        val decoded = BitmapFactory.decodeFile(staged.path)
        assertTrue(decoded.width <= 2048 && decoded.height <= 2048)
        decoded.recycle()
        val icon = cropStagedImage(context, staged.path, 1f, 5f, 1f, -1f, true)
        val small = BitmapFactory.decodeFile(icon.path)
        assertEquals(256, small.width)
        assertEquals(256, small.height)
        small.recycle()
        val portrait = cropStagedImage(context, staged.path, .75f, 1f, -1f, 1f, false)
        val full = BitmapFactory.decodeFile(portrait.path)
        assertTrue(full.width <= 1536)
        assertEquals(.75f, full.width.toFloat() / full.height, .002f)
        assertContentEquals(before, source.readBytes())
        full.recycle()
        source.delete()
        staged.delete()
        icon.delete()
        portrait.delete()
        Unit
    }
}
