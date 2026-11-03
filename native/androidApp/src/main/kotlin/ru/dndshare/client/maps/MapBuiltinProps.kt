package ru.dndshare.client.maps

import kotlinx.serialization.json.JsonObject

/** Static GLB exports of the web's buildMapProp; only Filament is used at runtime. */
object MapBuiltinProps {
    val labels =
        linkedMapOf(
            "door" to "Дверь",
            "double-door" to "Двойная дверь",
            "portcullis" to "Решётка",
            "barrel" to "Бочка",
            "crate" to "Ящик",
            "table" to "Стол",
            "chest" to "Сундук",
            "torch" to "Факел",
            "stairs" to "Лестница",
            "column" to "Колонна",
            "rubble" to "Завал",
            "bridge" to "Мост",
        )
    val interactive = setOf("door", "double-door", "portcullis", "chest", "torch")
    const val prefix = "builtin-map-prop://"

    fun model(row: JsonObject): MapModel {
        val kind = row.string("kind")
        require(kind in labels) { "Неизвестный вид объекта" }
        val state = if (kind in interactive && row.flag("open")) "open" else "closed"
        return MapModel(
            "builtin-$kind-$state",
            "",
            labels.getValue(kind),
            tileType = "object",
            renderUrl = "$prefix$kind/$state",
            maxHeight = 0.0,
            surfaceHeight = 0.0,
        )
    }

    fun bytes(url: String): ByteArray? {
        if (!url.startsWith(prefix)) return null
        val parts = url.removePrefix(prefix).split('/')
        require(
            parts.size == 2 &&
                parts[0] in labels &&
                parts[1] in listOf("open", "closed") &&
                (parts[1] == "closed" || parts[0] in interactive)
        )
        return requireNotNull(
                javaClass.classLoader?.getResourceAsStream(
                    "maps/builtin/${parts[0]}-${parts[1]}.glb"
                )
            ) {
                "Не удалось открыть встроенный объект"
            }
            .use { it.readBytes() }
    }
}
