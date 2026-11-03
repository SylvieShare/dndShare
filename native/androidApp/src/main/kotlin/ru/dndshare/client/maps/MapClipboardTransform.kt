package ru.dndshare.client.maps

import kotlinx.serialization.json.*

fun transformMapClipboard(
    clipboard: MapClipboard,
    catalogue: Collection<MapModel>,
    pivot: MapPose,
    mirror: Boolean,
): MapClipboard {
    val document = clipboard.document
    val tiles = document.rows("tiles")
    val objects = document.rows("objects")
    if (tiles.isEmpty() && objects.isEmpty()) return clipboard
    val models = catalogue.associateBy { it.uuid }
    val result =
        when {
            mirror && tiles.isNotEmpty() -> {
                val mirrored = mapMirrorGroup(tiles, models)
                val first = tiles.first()
                val size = mapFootprint(first, models.getValue(first.string("modelId")))
                val axis = first.number("x") + mirrored.first().number("x") + size.first
                mirrored to objects.map { it.with("x", JsonPrimitive(axis - it.number("x"))) }
            }
            mirror -> tiles to objects
            tiles.size == 1 && objects.isEmpty() ->
                tiles.map {
                    it.with("rotation", JsonPrimitive((it.number("rotation").toInt() + 90) % 360))
                } to objects
            else -> mapRotateGroup(tiles, objects, models, pivot)
        }
    return clipboard.copy(
        document =
            document
                .with("tiles", JsonArray(result.first))
                .with("objects", JsonArray(result.second))
    )
}
