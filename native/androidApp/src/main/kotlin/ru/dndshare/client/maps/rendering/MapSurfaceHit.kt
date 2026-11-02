package ru.dndshare.client.maps.rendering

import ru.dndshare.client.maps.geometry.Vec3

data class MapSurfaceHit(
    val id: String,
    val kind: String,
    val modelId: String,
    val world: Vec3,
    val local: Vec3,
    val normal: Vec3 = Vec3(0f, 1f, 0f),
)
