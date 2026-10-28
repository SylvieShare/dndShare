package ru.dndshare.client.print

import android.content.Context
import android.graphics.pdf.PdfDocument
import coil3.ImageLoader
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.allowHardware
import java.io.OutputStream
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext

/** Android's PDF canvas keeps the sheet printable offline without a web rendering runtime. */
suspend fun writeCharacterPdf(
    context: Context,
    content: CharacterPrintContent,
    images: ImageLoader,
    output: OutputStream,
): Unit =
    withContext(Dispatchers.IO) {
        val portrait =
            content.portrait?.let { url ->
                try {
                    (images.execute(
                            ImageRequest.Builder(context)
                                .data(url)
                                .size(512)
                                .allowHardware(false)
                                .build()
                        ) as? SuccessResult)
                        ?.image
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Exception) {
                    null
                }
            }
        val document = PdfDocument()
        val painter = CharacterPdfPainter(context, document, content.name) { ensureActive() }
        try {
            painter.cover(content.subtitle, portrait)
            for (block in content.blocks) {
                if (block.title.isNotBlank()) painter.heading(block.title)
                if (block.values.isNotEmpty()) painter.pairs(block.values)
                if (block.html.isNotBlank())
                    painter.rich(block.html) { url ->
                        ensureActive()
                        try {
                            (images.execute(
                                    ImageRequest.Builder(context)
                                        .data(
                                            if (url.startsWith('/'))
                                                ru.dndshare.client.BuildConfig.API_BASE_URL.trimEnd(
                                                    '/'
                                                ) + url
                                            else url
                                        )
                                        .size(1024)
                                        .allowHardware(false)
                                        .build()
                                ) as? SuccessResult)
                                ?.image
                        } catch (cancelled: CancellationException) {
                            throw cancelled
                        } catch (_: Exception) {
                            null
                        }
                    }
            }
            painter.finish()
            document.writeTo(output)
        } finally {
            painter.finish()
            document.close()
        }
    }
