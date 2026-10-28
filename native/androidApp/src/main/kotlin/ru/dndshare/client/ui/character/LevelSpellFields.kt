package ru.dndshare.client.ui.character

import androidx.compose.material3.*
import androidx.compose.runtime.*
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun LevelSpellFields(form: FeatureFormScope, plan: LevelAdvancement, cache: CacheDao) {
    val model = AdvancementSpellSelection(plan)
    val rules = model.rules ?: return
    var picking by remember { mutableStateOf(false) }
    Text("Заклинания · до ${model.maxCircle} круга", style = ShareTypography.card)
    Text(
        listOfNotNull(
                rules.cantrips?.let { "Заговоры: $it" },
                rules.spells?.let { "Заклинания: $it" },
                rules.levelUpChoices.takeIf { it > 0 }?.let { "Новых: $it" },
            )
            .joinToString(" · "),
        style = ShareTypography.context,
    )
    model.selected.forEach { id ->
        ShareTile(framed = false) {
            Text(plan.items[id]?.name ?: "Заклинание", style = ShareTypography.group)
            ShareTextButton(
                onClick = {
                    form.input(
                        "spells",
                        JsonArray(model.selected.filter { it != id }.map(::JsonPrimitive)),
                    )
                },
                enabled = form.enabled,
            ) {
                Text(if (id in model.original) "Заменить / убрать" else "Убрать")
            }
        }
    }
    ShareTextButton(onClick = { picking = true }, enabled = form.enabled) {
        Text("Изучить заклинание")
    }
    model.errors().distinct().forEach {
        Text(it, color = WebPalette.Warning, style = ShareTypography.context)
    }
    if (picking)
        SheetItemPicker(
            cache,
            plan.sheet,
            listOf(5L),
            { picking = false },
            eligibility = { model.eligibility(it) },
        ) { item ->
            form.input(
                "spells",
                JsonArray((model.selected + item.id).distinct().map(::JsonPrimitive)),
            )
            picking = false
        }
}
