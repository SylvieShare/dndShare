package ru.dndshare.client.maps.geometry

@androidx.annotation.Keep
internal object Meshopt {
    init {
        System.loadLibrary("dndshare_geometry")
    }

    external fun decode(
        source: ByteArray,
        count: Int,
        stride: Int,
        mode: Int,
        filter: Int,
    ): ByteArray
}
