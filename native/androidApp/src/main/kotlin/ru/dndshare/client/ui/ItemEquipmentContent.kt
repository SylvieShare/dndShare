package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.catch
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun ItemEquipmentContent(
    item: CatalogueItem,
    type: ItemType?,
    metadata: HandbookMetadata,
    open: (Long) -> Unit,
) {
    val context = LocalCataloguePreview.current
    val d = item.data
    val description =
        if (item.typeId == 1L) d.text("notes").ifBlank { d.text("desc") } else d.text("desc")
    if (description.isNotBlank())
        EquipmentSection("Описание") { RichDescription(description, openItem = open) }
    else EquipmentSection("Описание") { Text("Описание отсутствует", color = WebPalette.TextMuted) }
    val selected = selectedEquipmentBases(item, context.instance).map { it.first }.toSet()
    if (item.typeId == 19L) {
        listOf("weapon", "armor_base")
            .filter { d[it] is JsonObject }
            .forEach { kind ->
                if (kind !in selected)
                    EquipmentSection(
                        if (kind == "weapon") "Подходящее оружие" else "Подходящие доспехи и щиты",
                        if (kind == "weapon") Glyph.Swords else Glyph.ShieldCheck,
                    ) {
                        Text(
                            "Основа определяет обычные характеристики. Выберите её при добавлении предмета персонажу.",
                            style = ShareTypography.context,
                            color = WebPalette.TextSecondary,
                        )
                        EquipmentBases(item, kind, metadata, open)
                    }
                EquipmentAdditions(item, kind, metadata)
            }
    }
    if (d["contents"].arrayValue().isNotEmpty())
        EquipmentSection("Содержимое набора", Glyph.Backpack) {
            d["contents"].arrayValue().forEach { raw ->
                val row = raw.objectValue()
                row["item_id"].referenceId()?.let {
                    EquipmentReference(it, metadata, open, row["count"].number(1))
                }
            }
        }
    if (d["consumable"] == JsonPrimitive(true) || d["is_container"] == JsonPrimitive(true))
        EquipmentSection("Характеристики", Glyph.Backpack) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (d["consumable"] == JsonPrimitive(true))
                    ShareBadge("Расходуемое", color = WebPalette.Success)
                if (d["is_container"] == JsonPrimitive(true)) ShareBadge("Контейнер")
            }
        }
    EquipmentMechanicsContent(item, metadata, open)
    val fields = (type?.fields as? JsonArray).orEmpty().filterIsInstance<JsonObject>()
    val dedicated =
        catalogueSummary(item, type, metadata, context.instance).keys +
            setOf(
                "weapon",
                "armor_base",
                "weapon_bonus_transfer",
                "weapon_notes",
                "confirmed_uses",
                "weapon_uses",
                "selected_target",
                "status_effects",
                "desc",
                "description",
                "notes",
                "contents",
                "is_container",
                "consumable",
                "treasure",
                "resource_color",
            )
    val specialized =
        dedicated +
            (if (d["weapon"] is JsonObject) setOf("weapon_damage") else emptySet()) +
            (if (d["weapon"] is JsonObject || d["armor_base"] is JsonObject) setOf("last_charge")
            else emptySet())
    val remaining = fields.filter { it.text("key") !in specialized }
    val cache = context.cache
    if (cache != null)
        remaining.forEach { field ->
            val value = d[field.text("key")]
            if (
                value != null &&
                    value !is JsonNull &&
                    value != JsonPrimitive(false) &&
                    value != JsonPrimitive("") &&
                    (value !is JsonArray || value.isNotEmpty()) &&
                    (value !is JsonObject || value.isNotEmpty())
            )
                ShareTile(framed = false) {
                    SchemaFields(
                        JsonArray(listOf(field)),
                        d,
                        metadata,
                        cache,
                        context.sourceId,
                        open,
                    )
                }
        }
}

@Composable
private fun EquipmentBases(
    item: CatalogueItem,
    kind: String,
    metadata: HandbookMetadata,
    open: (Long) -> Unit,
) {
    val context = LocalCataloguePreview.current
    val rule = item.data[kind].objectValue()
    val fixed = rule["base_item_id"].referenceId()
    val allowed = rule["allowed_base_item_ids"].arrayValue().mapNotNull { it.referenceId() }
    if (fixed != null) {
        EquipmentReference(fixed, metadata, open)
        return
    }
    if (allowed.isNotEmpty()) {
        allowed.forEach { EquipmentReference(it, metadata, open) }
        return
    }
    val typeId = if (kind == "weapon") 1L else 12L
    var error by remember(item.id, kind) { mutableStateOf(false) }
    var attempt by remember(item.id, kind) { mutableIntStateOf(0) }
    val bases by
        produceState<List<Long>?>(null, item.id, kind, attempt, context.cache, context.sourceId) {
            error = false
            val cache = context.cache
            if (cache == null) {
                value =
                    context.items.values
                        .filter { it.typeId == typeId && it.id != 64L }
                        .map { it.id }
                return@produceState
            }
            cache
                .observeItems(context.sourceId, typeId, "", "%", Int.MAX_VALUE)
                .catch {
                    if (it is CancellationException) throw it
                    error = true
                    value = emptyList()
                }
                .collect { rows ->
                    value =
                        rows
                            .filter { row ->
                                row.id != 64L &&
                                    (kind == "weapon" ||
                                        runCatching {
                                                WireJson.decodeFromString<CatalogueItem>(
                                                        row.payload
                                                    )
                                                    .data["armor"] is
                                                    JsonObject
                                            }
                                            .getOrDefault(false))
                            }
                            .map { it.id }
                }
        }
    when {
        error -> {
            Text("Не удалось прочитать основы.", color = WebPalette.Danger)
            ShareTextButton({ attempt++ }) { Text("Повторить") }
        }
        bases == null -> repeat(2) { ShareSkeletonBlock(Modifier.fillMaxWidth().height(74.dp)) }
        bases!!.isEmpty() ->
            Text(
                "Подходящих основ нет. Уточните варианты у автора предмета.",
                color = WebPalette.TextMuted,
            )
        else -> EquipmentGrid(bases!!.map { id -> { EquipmentReference(id, metadata, open) } })
    }
}
