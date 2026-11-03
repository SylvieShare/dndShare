package ru.dndshare.client.maps.rendering

import ru.dndshare.client.maps.MapEntityRef
import ru.dndshare.client.maps.geometry.Vec3

data class MapSurfaceHit(
    val ref: MapEntityRef,
    val owner: MapEntityRef,
    val modelId: String,
    val world: Vec3,
    val local: Vec3,
    val normal: Vec3 = Vec3(0f, 1f, 0f),
)
