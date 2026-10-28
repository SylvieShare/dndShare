package ru.dndshare.client

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.test.core.app.ApplicationProvider
import coil3.ImageLoader
import java.io.File
import kotlin.test.*
import kotlinx.coroutines.runBlocking
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Suite
import ru.dndshare.client.print.*

@RunWith(Suite::class)
@Suite.SuiteClasses(PdfExportTest::class, PdfRichExportTest::class, RichImageViewerTest::class)
class CharacterReadingSuite

class PdfRichExportTest {
    @Test
    fun wideMergedTablesAndImagesProducePaginatedReadableNativePdf() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val image = File(context.cacheDir, "pdf-media.png")
        val file = File(context.cacheDir, "pdf-rich.pdf")
        val source = Bitmap.createBitmap(128, 80, Bitmap.Config.ARGB_8888)
        source.eraseColor(Color.MAGENTA)
        image.outputStream().use { assertTrue(source.compress(Bitmap.CompressFormat.PNG, 100, it)) }
        source.recycle()
        val table = buildString {
            append(
                "<table><tr><th rowspan=\"2\">Группа</th><th colspan=\"7\">Показатели</th></tr><tr>"
            )
            for (i in 1..7) append("<th>Колонка $i</th>")
            append("</tr>")
            for (row in 1..80) {
                append("<tr><td>Раздел $row</td>")
                for (col in 1..7) append(
                    if (row == 1 && col == 1)
                        "<td><img src=\"${image.toURI()}\" alt=\"Маркер\"></td>"
                    else "<td>Значение $row · $col</td>"
                )
                append("</tr>")
            }
            append("</table>")
        }
        val images = ImageLoader.Builder(context).build()
        try {
            val content =
                CharacterPrintContent(
                    "Проверка таблиц",
                    "D&D 5e",
                    image.toURI().toString(),
                    listOf(
                        CharacterPrintBlock("Таблица", html = table),
                        CharacterPrintBlock(
                            "Последняя иллюстрация",
                            html =
                                "<p>Финальная запись</p><img src=\"${image.toURI()}\" alt=\"Маркер\">",
                        ),
                    ),
                )
            file.outputStream().use { writeCharacterPdf(context, content, images, it) }
            var magenta = 0
            PdfRenderer(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)).use {
                renderer ->
                assertTrue(
                    renderer.pageCount >= 3,
                    "Wide bands and long rows must create real pages",
                )
                for (index in 0 until renderer.pageCount) renderer.openPage(index).use { page ->
                    val bitmap =
                        Bitmap.createBitmap(page.width, page.height, Bitmap.Config.ARGB_8888)
                    try {
                        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT)
                        if (index == 0)
                            File(context.filesDir, "parity-print-proof.png").outputStream().use {
                                assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it))
                            }

                        for (y in 36 until 760 step 2) for (x in 36 until 559 step 2) {
                            val color = bitmap.getPixel(x, y)
                            if (
                                Color.red(color) > 200 &&
                                    Color.blue(color) > 200 &&
                                    Color.green(color) < 60
                            )
                                magenta++
                        }
                    } finally {
                        bitmap.recycle()
                    }
                }
            }
            file.copyTo(File(context.filesDir, "parity-print-proof.pdf"), overwrite = true)
            assertTrue(
                magenta > 1000,
                "Images must be rendered into PDF, including real rich content",
            )
        } finally {
            images.shutdown()
            image.delete()
            file.delete()
        }
    }
}
