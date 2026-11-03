package ru.dndshare.client.ui.maps

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.*
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.MapAssetCache
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapReferenceWindow(
    workspace: MapEditorWorkspace,
    cache: MapAssetCache,
    images: ImageLoader,
) {
    val reference = workspace.reference
    val inputs = remember { ShareFormInputs() }
    var choose by remember { mutableStateOf(reference.draft == null) }
    fun leave() {
        inputs.flush()
        reference.request { workspace.referenceOpen = false }
    }
    ShareFullscreenDialog(::leave) {
        CompositionLocalProvider(
            LocalShareFormInputs provides inputs,
            LocalMapReference provides reference,
        ) {
            BackHandler(onBack = ::leave)
            BoxWithConstraints(
                Modifier.fillMaxSize()
                    .background(WebPalette.Background)
                    .windowInsetsPadding(WindowInsets.safeDrawing)
                    .imePadding()
                    .onPreviewKeyEvent { event ->
                        if (
                            event.type == KeyEventType.KeyDown &&
                                event.key == Key.S &&
                                (event.isCtrlPressed || event.isMetaPressed)
                        ) {
                            inputs.flush()
                            reference.save()
                            true
                        } else false
                    }
            ) {
                val wide = maxWidth >= 760.dp
                Column(
                    Modifier.widthIn(max = 1400.dp)
                        .fillMaxSize()
                        .align(Alignment.Center)
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "Справочник моделей",
                            Modifier.weight(1f),
                            style = ShareTypography.header,
                        )
                        if (!wide) MapToolButton("Выбрать модель", Glyph.Box) { choose = !choose }
                        MapToolButton("Закрыть справочник", Glyph.Close, !reference.saving, ::leave)
                    }
                    Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                        if (wide || choose)
                            Column(
                                Modifier.width(
                                        if (wide) 260.dp
                                        else this@BoxWithConstraints.maxWidth - 24.dp
                                    )
                                    .fillMaxHeight(),
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    for ((kind, label) in
                                        listOf(
                                            "tile" to "Плитки",
                                            "object" to "Объекты",
                                        )) ShareChoiceChip(
                                        workspace.ui.referenceKind == kind,
                                        {
                                            inputs.flush()
                                            reference.kind(kind)
                                        },
                                        { Text(label) },
                                    )
                                }
                                MapModelPalette(
                                    workspace,
                                    images,
                                    workspace.ui.referenceKind == "object",
                                    inspect = true,
                                    selectedId = reference.draft?.modelId.orEmpty(),
                                    collectionChange = {
                                        inputs.flush()
                                        reference.collection(it)
                                    },
                                    choose = {
                                        inputs.flush()
                                        reference.choose(it)
                                        if (reference.currentDraft?.modelId == it.uuid)
                                            choose = false
                                    },
                                )
                            }
                        if (wide || !choose)
                            Box(Modifier.weight(1f)) {
                                if (reference.draft == null)
                                    Text(
                                        "Выберите модель для просмотра параметров.",
                                        color = WebPalette.TextMuted,
                                    )
                                else
                                    key(reference.draft!!.modelId) {
                                        MapReferenceForm(workspace, cache)
                                    }
                            }
                    }
                    reference.error?.let {
                        Text(it, color = WebPalette.Danger, style = ShareTypography.context)
                        ShareTextButton(
                            reference::reload,
                            enabled = !reference.reloading && !reference.saving,
                        ) {
                            AppGlyph(Glyph.Refresh)
                            Text(if (reference.reloading) "Обновляем…" else "Обновить справочник")
                        }
                    }
                    reference.status?.let {
                        Text(it, color = WebPalette.Success, style = ShareTypography.context)
                    }
                    if (reference.draft != null)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            ShareButton(
                                {
                                    inputs.flush()
                                    reference.save()
                                },
                                enabled = reference.draft?.dirty == true && !reference.saving,
                            ) {
                                AppGlyph(Glyph.Save)
                                Text(if (reference.saving) "Сохраняем…" else "Сохранить")
                            }
                            ShareTextButton(
                                {
                                    inputs.flush()
                                    reference.reset()
                                },
                                enabled = reference.draft?.dirty == true && !reference.saving,
                            ) {
                                Text("Отменить изменения")
                            }
                        }
                }
            }
            if (reference.confirmDiscard)
                ShareAlertDialog(
                    onDismissRequest = reference::keep,
                    title = { Text("Отменить изменения параметров?") },
                    text = { Text("У текущей модели есть несохранённые параметры.") },
                    confirmButton = {
                        ShareTextButton(reference::discard) { Text("Отменить изменения") }
                    },
                    dismissButton = { ShareTextButton(reference::keep) { Text("Продолжить") } },
                )
        }
    }
}
