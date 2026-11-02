package ru.dndshare.client.maps.geometry

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.nio.ByteBuffer
import java.nio.ByteOrder

@androidx.annotation.Keep
internal object MapTextureCodec {
    init {
        System.loadLibrary("dndshare_geometry")
    }

    private external fun decodeKtx2(source: ByteArray, maximum: Int): ByteArray?

    fun decode(bytes: ByteArray, maximum: Int = 2048): Bitmap {
        if (bytes.size >= 12 && bytes[0] == 0xab.toByte() && bytes[5] == 0x32.toByte()) {
            val raw =
                requireNotNull(decodeKtx2(bytes, maximum)) { "Не удалось открыть KTX2-текстуру" }
            val buffer = ByteBuffer.wrap(raw).order(ByteOrder.LITTLE_ENDIAN)
            val width = buffer.int
            val height = buffer.int
            return Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).apply {
                copyPixelsFromBuffer(buffer)
                setPremultiplied(false)
            }
        }
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        require(bounds.outWidth in 1..16384 && bounds.outHeight in 1..16384)
        val options =
            BitmapFactory.Options().apply {
                inSampleSize = 1
                inPremultiplied = false
                while (
                    maxOf(bounds.outWidth, bounds.outHeight) / inSampleSize > maximum
                ) inSampleSize *= 2
                inPreferredConfig = Bitmap.Config.ARGB_8888
            }
        return requireNotNull(BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options))
    }
}
