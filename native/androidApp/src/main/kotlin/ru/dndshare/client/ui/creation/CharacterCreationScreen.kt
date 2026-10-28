package ru.dndshare.client.ui.creation

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CharacterCreationScreen(
    ui: CreationUiState,
    model: CharacterCreationViewModel,
    images: ImageLoader,
    close: () -> Unit,
) {
    var confirmReset by remember { mutableStateOf(false) }
    var partial by remember { mutableStateOf(false) }
    var preview by remember { mutableStateOf(false) }
    val draft = ui.draft
    val inputs = remember { ShareFormInputs() }
    val steps =
        if (draft.template == "VTM20") listOf("Персонаж")
        else
            listOf(
                "Редакция",
                "Происхождение",
                "Класс",
                "Предыстория",
                "Характеристики",
                "Личность",
            ) +
                if (draft.buyEquipment && draft.version == "2014") listOf("Магазин")
                else emptyList()
    BackHandler {
        if (!ui.busy) {
            if (draft.step > 0) model.update { it.copy(step = it.step - 1) } else close()
        }
    }
    CompositionLocalProvider(LocalShareFormInputs provides inputs) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).imePadding()) {
            ShareWorkspaceHeader(
                navigation =
                    if (draft.template == "DND5")
                        ({
                            Row(
                                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                steps.forEachIndexed { index, label ->
                                    FilterChip(
                                        draft.step == index,
                                        { model.update { it.copy(step = index) } },
                                        enabled = index <= draft.step && !ui.busy,
                                        label = { Text("${index+1}. $label") },
                                    )
                                }
                            }
                        })
                    else null
            ) {
                IconButton(onClick = close, enabled = !ui.busy) { AppGlyph(Glyph.Back) }
                Text("Создание персонажа", Modifier.weight(1f), style = ShareTypography.header)
                TextButton(onClick = { confirmReset = true }, enabled = !ui.busy) {
                    Text("Сбросить")
                }
            }
            if (ui.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
                Column(
                    Modifier.widthIn(max = 1200.dp)
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(18.dp),
                ) {
                    if (ui.error != null) {
                        Text(ui.error, style = ShareTypography.group, color = WebPalette.Danger)
                        if (ui.catalogue.isEmpty())
                            TextButton(onClick = model::load) { Text("Повторить загрузку") }
                    }
                    if (draft.template == "VTM20") {
                        ShareTextInput(
                            draft.name,
                            { model.update { old -> old.copy(name = it) } },
                            "Имя персонажа",
                        )
                        Text("Vampire: The Masquerade V20", style = ShareTypography.group)
                        CreationMediaFields(ui, model)
                        TextButton(onClick = { model.system("DND5", "2014") }) {
                            Text("Выбрать D&D 5e")
                        }
                    } else
                        AnimatedContent(draft.step, label = "Creation step") { step ->
                            Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
                                CreationStep(step, ui, model, images)
                            }
                        }
                }
            }
            Surface(color = WebPalette.Surface, shadowElevation = 4.dp) {
                Row(
                    Modifier.fillMaxWidth().padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
                ) {
                    if (draft.template == "DND5")
                        TextButton(onClick = { preview = true }, enabled = !ui.loading) {
                            Text("Предпросмотр")
                        }
                    if (draft.step > 0)
                        TextButton(
                            onClick = { model.update { it.copy(step = it.step - 1) } },
                            enabled = !ui.busy,
                        ) {
                            Text("Назад")
                        }
                    if (draft.template == "DND5" && draft.step < steps.lastIndex)
                        Button(
                            onClick = {
                                inputs.flush()
                                model.next()
                            },
                            enabled = !ui.loading && !ui.busy,
                        ) {
                            Text("Дальше")
                        }
                    else
                        Button(
                            onClick = {
                                inputs.flush()
                                val current = model.state.value
                                val errors =
                                    if (current.draft.template == "VTM20")
                                        creationErrors(current.context, 0)
                                    else
                                        (0..5).flatMap { creationErrors(current.context, it) } +
                                            equipmentErrors(current.context)
                                if (errors.isEmpty()) model.create() else partial = true
                            },
                            enabled = !ui.loading && !ui.busy,
                        ) {
                            Text(if (ui.busy) "Создаём…" else "Создать")
                        }
                }
            }
        }
    }
    if (confirmReset)
        AlertDialog(
            onDismissRequest = { confirmReset = false },
            title = { Text("Сбросить черновик?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmReset = false
                        model.reset()
                    }
                ) {
                    Text("Сбросить")
                }
            },
            dismissButton = { TextButton(onClick = { confirmReset = false }) { Text("Отмена") } },
        )
    if (partial)
        AlertDialog(
            onDismissRequest = { partial = false },
            title = { Text("Создать неполного персонажа?") },
            text = {
                Text(
                    ((0..5).flatMap { creationErrors(ui.context, it) } +
                            equipmentErrors(ui.context))
                        .distinct()
                        .joinToString("\n")
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        partial = false
                        model.create(partial = true)
                    }
                ) {
                    Text("Создать как есть")
                }
            },
            dismissButton = {
                TextButton(onClick = { partial = false }) { Text("Продолжить заполнение") }
            },
        )
    if (preview) CreationPreview(ui, images, { preview = false })
}
