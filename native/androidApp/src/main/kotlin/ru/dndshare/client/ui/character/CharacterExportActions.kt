package ru.dndshare.client.ui.character

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.dndshare.client.BuildConfig
import ru.dndshare.client.print.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CharacterExportActions() {
    val sheet = LocalCharacterSheet.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var exporting by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    val state = rememberUpdatedState(sheet)
    val createPdf =
        rememberLauncherForActivityResult(
            ActivityResultContracts.CreateDocument("application/pdf")
        ) { uri ->
            if (uri != null)
                scope.launch {
                    exporting = true
                    message = null
                    try {
                        val current = state.value
                        val content =
                            withContext(Dispatchers.Default) {
                                characterPrintContent(
                                    current.sheet,
                                    current.items,
                                    current.metadata,
                                )
                            }
                        withContext(Dispatchers.IO) {
                            context.contentResolver.openOutputStream(uri, "w")?.use {
                                writeCharacterPdf(context, content, current.images, it)
                            } ?: error("Не удалось создать файл.")
                        }
                        message = "PDF сохранён"
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (error: Exception) {
                        message = error.message ?: "Не удалось создать PDF."
                    } finally {
                        exporting = false
                    }
                }
        }
    ShareTextButton(
        onClick = {
            createPdf.launch(
                sheet.sheet.name.replace(Regex("[^\\p{L}\\p{N} _-]"), "").take(100).ifBlank {
                    "Персонаж"
                } + ".pdf"
            )
        },
        enabled = !exporting,
    ) {
        Text(if (exporting) "Создаём PDF…" else "Сохранить PDF")
    }
    ShareTextButton(
        onClick = {
            val url = BuildConfig.API_BASE_URL.trimEnd('/') + "/char/" + sheet.uuid
            context.startActivity(
                Intent.createChooser(
                    Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, url)
                        putExtra(Intent.EXTRA_SUBJECT, sheet.sheet.name)
                    },
                    "Поделиться листом",
                )
            )
        },
        enabled = sheet.sheet.publicVisible,
    ) {
        Text("Поделиться ссылкой")
    }
    if (!sheet.sheet.publicVisible)
        Text("Чтобы поделиться листом, включите публичную ссылку.", style = ShareTypography.context)
    message?.let { Text(it, style = ShareTypography.context) }
}
