package ru.dndshare.client

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import coil3.ImageLoader
import kotlin.test.*
import kotlinx.coroutines.runBlocking
import org.junit.Test
import org.junit.runner.RunWith
import ru.dndshare.client.print.*

@RunWith(AndroidJUnit4::class)
class PdfExportTest {
    @Test
    fun longCyrillicSheetProducesReadableA4PagesWithoutCuttingTheLastBlock() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val images = ImageLoader.Builder(context).build()
        val file = java.io.File(context.cacheDir, "native-sheet-test.pdf")
        try {
            val content =
                CharacterPrintContent(
                    "Лира · Тест",
                    "D&D 5e · 2014",
                    null,
                    listOf(
                        CharacterPrintBlock(
                            "История",
                            html =
                                (1..500).joinToString("") {
                                    "<p>Строка $it: <b>герой</b> исследует мир и сохраняет воспоминания.</p>"
                                },
                        ),
                        CharacterPrintBlock(
                            "Последний раздел",
                            html =
                                (1..20).joinToString("") {
                                    "<p>Финальная запись $it: всё содержимое доступно в PDF.</p>"
                                },
                        ),
                    ),
                )
            file.outputStream().use { writeCharacterPdf(context, content, images, it) }
            assertTrue(file.length() > 1000)
            val renderer =
                PdfRenderer(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY))
            try {
                assertTrue(renderer.pageCount > 3)
                val page = renderer.openPage(renderer.pageCount - 1)
                try {
                    assertEquals(595, page.width)
                    assertEquals(842, page.height)
                    val bitmap =
                        Bitmap.createBitmap(page.width, page.height, Bitmap.Config.ARGB_8888)
                    bitmap.eraseColor(Color.WHITE)
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT)
                    var colored = 0
                    for (y in 36 until 700) for (x in 36 until 559) if (
                        bitmap.getPixel(x, y) != Color.WHITE
                    )
                        colored++
                    assertTrue(
                        colored > 300,
                        "The last page must contain its body, not only a footer",
                    )
                    bitmap.recycle()
                } finally {
                    page.close()
                }
            } finally {
                renderer.close()
            }
        } finally {
            images.shutdown()
            file.delete()
        }
        Unit
    }
}
