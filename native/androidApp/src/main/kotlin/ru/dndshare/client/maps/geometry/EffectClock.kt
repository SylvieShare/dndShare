package ru.dndshare.client.maps.geometry

import kotlin.math.PI
import kotlin.math.floor

/** All water/fire frequencies are multiples of 0.1; this wrap preserves every phase. */
fun mapEffectPhase(seconds: Double, speed: Double = 1.0): Double =
    (floor(seconds * 12) / 12 * speed) % (20 * PI)
