package ru.dndshare.client.maps

import java.text.Collator
import java.util.Locale

data class MapCatalogueSection(
    val key: String,
    val name: String,
    val subtitle: String,
    val models: List<MapModel>,
)

val mapTileCategories =
    listOf(
        "floor" to "Пол",
        "wall" to "Стены",
        "water" to "Вода и реки",
        "railway" to "Железная дорога",
        "stairs" to "Лестницы",
        "frame" to "Каркасы",
        "bridge" to "Мосты",
        "passage" to "Проходы и двери",
        "column" to "Колонны",
    )
val mapWallTypes =
    listOf(
        "wall-straight" to "Прямые стены",
        "wall-angle" to "Внутренние углы",
        "wall-tee" to "Т-образные стены",
        "wall-cross" to "Х-образные стены",
        "wall-corner" to "Наружные углы",
        "wall-diagonal" to "Диагональные стены",
        "wall-end" to "Выступы и окончания стен",
    )

fun mapCatalogueSections(
    models: List<MapModel>,
    wallSubcategories: Boolean,
): List<MapCatalogueSection> {
    val collator = Collator.getInstance(Locale.ENGLISH).apply { strength = Collator.PRIMARY }
    val tokens = mutableMapOf<String, List<String>>()
    fun parts(value: String) =
        tokens.getOrPut(value) { Regex("[0-9]+|[^0-9]+").findAll(value).map { it.value }.toList() }
    fun compare(a: String, b: String): Int {
        val left = parts(a)
        val right = parts(b)
        for (i in 0 until minOf(left.size, right.size)) {
            val x = left[i]
            val y = right[i]
            val order =
                if (x.first().isDigit() && y.first().isDigit()) {
                    val nx = x.trimStart('0').ifEmpty { "0" }
                    val ny = y.trimStart('0').ifEmpty { "0" }
                    nx.length.compareTo(ny.length).takeIf { it != 0 } ?: nx.compareTo(ny)
                } else collator.compare(x, y)
            if (order != 0) return order
        }
        return left.size.compareTo(right.size)
    }
    return models
        .groupBy { "${it.collection}:${it.code}" }
        .toList()
        .sortedWith { a, b -> compare(a.second.first().code, b.second.first().code) }
        .flatMap { (key, entries) ->
            val sorted = entries.sortedWith { a, b ->
                compare(a.variantCode.ifBlank { a.id }, b.variantCode.ifBlank { b.id }).takeIf {
                    it != 0
                } ?: compare(a.id, b.id)
            }
            val name =
                entries.first().groupName.ifBlank { entries.first().code.ifBlank { "Модели" } }
            if (wallSubcategories)
                mapWallTypes.mapNotNull { (kind, title) ->
                    val rows = sorted.filter { it.tileType == kind }
                    if (rows.isEmpty()) null
                    else MapCatalogueSection("$key:$kind", name, title, rows)
                }
            else listOf(MapCatalogueSection(key, name, "", sorted))
        }
}
