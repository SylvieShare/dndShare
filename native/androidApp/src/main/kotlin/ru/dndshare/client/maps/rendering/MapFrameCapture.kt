package ru.dndshare.client.maps.rendering

import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import com.google.android.filament.*
import java.nio.ByteBuffer
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.*

/** Read the exact submitted GPU frame. SurfaceView's last presented buffer can be older. */
internal class MapFrameCapture : AutoCloseable {
    private class Request(val region: MapFrameRegion?, val result: (Result<Bitmap>) -> Unit) {
        val completed = AtomicBoolean(false)
    }

    private val main = Handler(Looper.getMainLooper())
    private val pending = ArrayDeque<Request>()
    private val active = ConcurrentHashMap.newKeySet<Request>()
    private val reads = AtomicInteger()
    private var closed = false
    val working
        get() = reads.get() > 0 || pending.isNotEmpty()

    fun request(region: MapFrameRegion? = null, result: (Result<Bitmap>) -> Unit) {
        if (closed || active.size >= 3) {
            main.post { result(Result.failure(IllegalStateException("Снимок сейчас недоступен"))) }
            return
        }
        val request = Request(region, result)
        pending += request
        active += request
    }

    fun render(renderer: Renderer, width: Int, height: Int) {
        if (pending.isEmpty()) return
        val grouped = pending.toList().groupBy { it.region ?: MapFrameRegion(0, 0, width, height) }
        pending.clear()
        for ((region, requests) in grouped) read(renderer, width, height, region, requests)
    }

    private fun read(
        renderer: Renderer,
        viewportWidth: Int,
        viewportHeight: Int,
        region: MapFrameRegion,
        requests: List<Request>,
    ) {
        val width = region.width
        val height = region.height
        if (
            region.left < 0 ||
                region.top < 0 ||
                width <= 0 ||
                height <= 0 ||
                region.left + width > viewportWidth ||
                region.top + height > viewportHeight
        ) {
            requests.forEach {
                complete(it, Result.failure(IllegalStateException("Область превью вне кадра")))
            }
            return
        }
        val bytes = ByteBuffer.allocateDirect(width * height * 4)
        reads.incrementAndGet()
        try {
            renderer.readPixels(
                region.left,
                viewportHeight - region.top - height,
                width,
                height,
                Texture.PixelBufferDescriptor(
                    bytes,
                    Texture.Format.RGBA,
                    Texture.Type.UBYTE,
                    main,
                    Runnable {
                        reads.decrementAndGet()
                        CoroutineScope(Dispatchers.Default).launch {
                            val result = runCatching {
                                val pixels = IntArray(width * height)
                                for (y in 0 until height) for (x in 0 until width) {
                                    val i =
                                        (y * width + x) *
                                            4 // Filament readPixels already returns top-left rows.
                                    pixels[y * width + x] =
                                        ((bytes.get(i + 3).toInt() and 255) shl 24) or
                                            ((bytes.get(i).toInt() and 255) shl 16) or
                                            ((bytes.get(i + 1).toInt() and 255) shl 8) or
                                            (bytes.get(i + 2).toInt() and 255)
                                }
                                Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
                            }
                            for ((index, request) in requests.withIndex()) {
                                val value = result.map {
                                    if (index == requests.lastIndex) it
                                    else it.copy(Bitmap.Config.ARGB_8888, false)
                                }
                                if (!complete(request, value)) value.getOrNull()?.recycle()
                            }
                        }
                    },
                ),
            )
        } catch (error: Throwable) {
            reads.decrementAndGet()
            requests.forEach { complete(it, Result.failure(error)) }
            throw error
        }
    }

    private fun complete(request: Request, value: Result<Bitmap>): Boolean {
        if (!request.completed.compareAndSet(false, true)) return false
        active -= request
        main.post { request.result(value) }
        return true
    }

    fun fail(error: Throwable) {
        pending.clear()
        active.toList().forEach { complete(it, Result.failure(error)) }
    }

    override fun close() {
        closed = true
        fail(CancellationException("Редактор закрыт"))
    }
}
