package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun WeaponCataloguePanels(entry: JsonObject, item: CatalogueItem) {
    val context = LocalCharacterSheet.current
    val uid = entry.text("uid")
    val magic = entry["params"].objectValue()["magic"].objectValue()
    if (magic["lost"] == JsonPrimitive(true) || entry["count"].number(1) <= 0) return
    val allNotes = item.data["weapon_notes"].arrayValue().map { it.objectValue() }
    if (allNotes.isEmpty() && item.data["status_effects"].arrayValue().isEmpty()) return
    val active = magicActive(item, entry, true, context.sheet)
    val notes = allNotes.filter {
        it.text("title").isNotBlank() && it.text("description").isNotBlank() && when (it.text("when")) {
            "always" -> true
            "attuned" -> magic["attuned"] == JsonPrimitive(true)
            "active" -> item.typeId != 19L || active
            else -> false
        }
    }
    val effects = if (active) statusEffectLinks(item) else emptyList()
    if (notes.isEmpty() && effects.isEmpty()) return
    val charges = remember(context.sheet, context.items, uid, item) {
        if (active && (effects.isNotEmpty() || notes.any { "resource_key" in it }))
            cataloguePanelCharges(context.sheet, context.items, uid, item, allNotes, effects)
        else PanelCharges(emptyMap(), emptyList())
    }
    for (note in notes) key(uid, note.text("key")) {
        val curse = note.text("kind") == "curse"
        val tone = if (curse) WebPalette.Danger else WebPalette.Info
        CatalogueWeaponDisclosure(
            if (curse) "Проклятие" else "Свойство", note.text("title"), tone, Glyph.Wand,
            listOfNotNull(charges.notes[note.text("key")]),
        ) {
            RichDescription(note.text("description"), openItem = context.openItem)
            EquipmentTheses(note["requirements"].arrayValue().mapNotNull { (it as? JsonPrimitive)?.contentOrNull }, tone)
        }
    }
    if (effects.isNotEmpty()) key(uid, "effects") {
        CatalogueWeaponDisclosure("Связанный эффект", "Эффекты оружия", WebPalette.Accent, Glyph.Wand, charges.effects) {
            val preview = LocalCataloguePreview.current.copy(items = context.items, images = context.images, sourceId = context.sheet.sourceId)
            CompositionLocalProvider(LocalCataloguePreview provides preview) {
                for (link in effects) {
                    val id = statusEffectId(link) ?: continue
                    EquipmentReference(id, context.metadata, context.openItem)
                    Text(if (link.text("target") == "other") "На цель" else "На владельца", style = ShareTypography.context)
                    EquipmentTheses(link.text("condition").split(';', '\n').map(String::trim))
                }
            }
        }
    }
}

private data class PanelCharges(val notes: Map<String, ResourceControl>, val effects: List<ResourceControl>)

private fun cataloguePanelCharges(
    sheet: CharacterSheet, items: Map<Long, CatalogueItem>, uid: String, item: CatalogueItem,
    notes: List<JsonObject>, effects: List<JsonObject>,
): PanelCharges {
    val pools = resourceControls(sheet, items).filter { it.owner?.valueId == "magic_items" && it.owner.entryKey == uid }
        .associateBy { it.owner!!.resourceKey }.toMutableMap()
    fun rules(field: String) = item.data[field].arrayValue().map { it.objectValue() }
    fun usesPool(rule: JsonObject) = rule["uses_resource"] == JsonPrimitive(true) ||
        rule.text("resource_key").isNotBlank() || rule["resource_cost"].number() > 0
    // The same precedence as weaponBlockResources: each instance pool has one counter.
    for (rule in rules("confirmed_uses") + rules("weapon_uses").filter(::usesPool))
        pools.remove(rule.text("resource_key"))
    val noteCharges = buildMap {
        for (note in notes) if ("resource_key" in note)
            pools.remove(note.text("resource_key"))?.let { put(note.text("key"), it) }
    }
    val actions = rules("feature_actions")
    val damage = rules("weapon_damage")
    val effectCharges = buildList {
        for (link in effects) {
            val rule = actions.find { it.text("key") == link.text("key") && usesPool(it) }
                ?: damage.find { it.text("key").isNotBlank() && it.text("key") == link.text("weapon_damage_key") && usesPool(it) }
            if (rule != null) pools.remove(rule.text("resource_key"))?.let(::add)
        }
        if (effects.isNotEmpty()) pools.remove("")?.let(::add)
    }
    return PanelCharges(noteCharges, effectCharges)
}

@Composable
private fun CatalogueWeaponDisclosure(
    kind: String, title: String, tone: Color, icon: Glyph, charges: List<ResourceControl>,
    content: @Composable ColumnScope.() -> Unit,
) {
    var error by remember { mutableStateOf<String?>(null) }
    var expanded by rememberSaveable { mutableStateOf(false) }
    ShareActionDisclosure(kind, title, expanded, { expanded = it }, color = tone,
        leading = { AppGlyph(icon, Modifier.size(24.dp), tone) },
        trailing = {
            if (charges.isNotEmpty()) Column(Modifier.widthIn(max = 136.dp)) {
                for (pool in charges) {
                    if (charges.size > 1) Text(pool.title, style = ShareTypography.context)
                    ItemResourceOrbs(pool, { error = it })
                }
            }
        },
        content = content,
    )
    error?.let { Text(it, style = ShareTypography.context, color = WebPalette.Danger) }
}
