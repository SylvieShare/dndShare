package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun AbilityStatusPanel(bucket: String, entry: JsonObject, item: CatalogueItem) {
    val context = LocalCharacterSheet.current
    val feature =
        ownedFeatures(context.sheet, context.items).firstOrNull {
            it.key == bucket &&
                it.entry.referenceId() == item.id &&
                featureEntryKey(it) == entry.text("uid").ifBlank { entry.text("id") }
        } ?: return
    val links = statusEffectLinks(item).filter { it.text("target") != "other" }
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    FlowRow {
        links.forEach { link ->
            val active = linkedStatusActive(context.sheet, feature, link)
            val effect = context.items[statusEffectId(link)]
            TextButton(
                onClick = {
                    busy = true
                    scope.launch {
                        try {
                            error =
                                context.itemMechanic(
                                    featureEntryKey(feature),
                                    "ability-status",
                                    buildJsonObject {
                                        put("bucket", bucket)
                                        put("link", link.text("key"))
                                    },
                                )
                        } finally {
                            busy = false
                        }
                    }
                },
                enabled = context.canEdit && !busy && effect != null,
            ) {
                Text("${if(active) "Снять" else "Добавить"} ${effect?.name ?: "эффект"}")
            }
        }
        resourceControls(context.sheet, context.items)
            .firstOrNull { it.key == "abilities:$bucket:${featureEntryKey(feature)}" }
            ?.let { resource ->
                TextButton(
                    onClick = { context.adjustResource(resource.key, -1) },
                    enabled = context.canEdit && resource.value > 0,
                ) {
                    Text("Использовать (${resource.value}/${resource.total})")
                }
            }
    }
    error?.let { Text(it, color = WebPalette.Danger) }
}
