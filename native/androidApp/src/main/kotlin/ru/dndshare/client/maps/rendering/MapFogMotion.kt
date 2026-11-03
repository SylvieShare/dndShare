package ru.dndshare.client.maps.rendering

internal data class MapFogMotion(
    val active: Set<String> = emptySet(),
    val weights: Map<String, Double> = emptyMap(),
)
