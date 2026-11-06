package ru.dndshare.client.ui.character

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.JsonPrimitive
import ru.dndshare.client.character.RuleContext
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SkillFeatureFields(form: FeatureFormScope) {
    val context = LocalCharacterSheet.current
    val (_, stat, id) = form.editor.fields.target.split(':')
    val ability = dndAbilities.first { it.id == stat }
    val save = id == "save"
    val rule = if (save) "save_proficiency" else "skill_proficiency"
    val scope = RuleContext(kind = if (save) "saving_throw" else "skill_check",
        ability = ability.suggestId, skill = id.toLongOrNull())
    val granted = context.mechanics.rank(rule, scope)
    if (save) {
        ShareToggle("Владение спасброском", granted > 0 || form.data["up"] == JsonPrimitive(true),
            form.enabled && granted == 0) { form.input("up", JsonPrimitive(it)) }
    } else {
        form.TextField("override_title", "Своё название")
        Text("Владение", style = ShareTypography.group)
        val options = listOf(
            ShareNavigationItem("0", "Без владения"),
            ShareNavigationItem("1", "Владение"),
            ShareNavigationItem("2", "Компетентность"),
        )
        ShareIconNavigation(options, form.text("up").ifBlank { "0" },
            { if (form.enabled) form.set("up", it) }, itemSize = 94.dp, itemHeight = 54.dp) {
            AppGlyph(when (it) { "2" -> Glyph.Gem; "1" -> Glyph.CircleCheck; else -> Glyph.Minus })
        }
    }
    val sources = context.mechanics.rules(rule, scope).map { it.sourceLabel }.distinct()
    if (sources.isNotEmpty()) Text("Источник: ${sources.joinToString()}", style = ShareTypography.context, color = WebPalette.TextMuted)
    BonusFields(form)
    if (id != "save" && id.toLongOrNull() == null)
        form.Toggle("remove", "Удалить навык")
}
