package ru.dndshare.client.character

import ru.dndshare.client.model.CatalogueItem
import ru.dndshare.client.model.text

// characterResources.js: deterministic palette is part of the shared resource presentation.
private val resourceColors =
    listOf(
        "#f87171",
        "#fbbf24",
        "#4ade80",
        "#38bdf8",
        "#c084fc",
        "#94a3b8",
        "#fb7185",
        "#fb923c",
        "#2dd4bf",
        "#60a5fa",
        "#818cf8",
        "#e879f9",
    )

internal fun resourceDisplayColor(
    resource: ResourceControl,
    items: Map<Long, CatalogueItem>,
): String {
    val rule = resource.rule
    rule.text("color_point").takeIf(String::isNotBlank)?.let {
        return it
    }
    val item = resource.owner?.let { items[it.itemId] }
    rule
        .text("resource_color")
        .ifBlank { item?.data?.text("resource_color").orEmpty() }
        .takeIf(String::isNotBlank)
        ?.let {
            return it
        }
    if (item != null) {
        val seed = "${item.id}:${resource.owner.resourceKey.ifBlank { "main" }}"
        val hash = seed.fold(0u) { value, char -> value * 31u + char.code.toUInt() }
        return resourceColors[(hash % resourceColors.size.toUInt()).toInt()]
    }
    return rule.text("color").ifBlank { if (resource.key.startsWith("classes:")) "#fbbf24" else "" }
}
