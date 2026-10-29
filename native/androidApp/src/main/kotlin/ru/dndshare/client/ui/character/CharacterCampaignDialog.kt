package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CharacterCampaignDialog(
    remote: SheetRemoteState,
    ui: SheetCampaignState,
    commands: CharacterCampaignController,
    selectSession: (String) -> Unit,
    close: () -> Unit,
    openCharacter: (String) -> Unit,
    initialTab: String = "players",
) {
    val context = LocalCharacterSheet.current
    var tab by remember { mutableStateOf(initialTab) }
    var message by remember(ui.peer, ui.messagesSent) { mutableStateOf("") }
    val registry = remember { ShareFormInputs() }
    CompositionLocalProvider(LocalShareFormInputs provides registry) {
        ShareFormDialog("Сессия", close) {
            if (remote.sessions.size > 1)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    remote.sessions.forEach { session ->
                        ShareChoiceChip(
                            session.uuid == remote.sessionUuid,
                            { selectSession(session.uuid) },
                            label = { Text(session.name) },
                        )
                    }
                }
            if (ui.loading) ShareSkeletonBlock(Modifier.fillMaxWidth(), 36.dp)
            ui.error?.let { Text(it, color = WebPalette.Danger) }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ShareChoiceChip(
                    tab == "players",
                    {
                        tab = "players"
                        commands.closePeer()
                    },
                    label = { Text("Игроки") },
                )
                ShareChoiceChip(
                    tab == "events",
                    {
                        tab = "events"
                        commands.closePeer()
                    },
                    label = { Text("События") },
                )
                ShareTextButton(onClick = commands::refresh) { Text("Обновить") }
            }
            if (ui.peer != null) {
                if (ui.hasMore) ShareTextButton(onClick = commands::older) { Text("Ранее") }
                ui.conversation.forEach { event -> InteractionView(event, context.uuid, commands) }
                key(ui.peer, ui.messagesSent) {
                    ShareTextInput(
                        message,
                        { message = it },
                        "Сообщение",
                        multiline = true,
                        enabled = !ui.busy,
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ShareButton(
                        onClick = {
                            registry.flush()
                            commands.message(message)
                        },
                        enabled = !ui.busy && message.isNotBlank(),
                    ) {
                        Text("Отправить")
                    }
                    ShareTextButton(onClick = commands::challenge, enabled = !ui.busy) {
                        Text("Камень / ножницы / бумага")
                    }
                }
            } else if (tab == "players") {
                if (ui.players.isEmpty() && !ui.loading)
                    SheetEmpty("В сессии пока нет других персонажей")
                ui.players
                    .filter { it.text("charUuid") != context.uuid }
                    .forEach { player ->
                        val values = player["data"].objectValue()["values"].objectValue()
                        val name =
                            values
                                .text(
                                    if (player.text("templateName") == "VTM20") "char_name"
                                    else "name"
                                )
                                .ifBlank { "Персонаж" }
                        ShareTile(framed = false) {
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                player.text("iconImageUrl").takeIf(String::isNotBlank)?.let {
                                    AsyncImage(
                                        it,
                                        null,
                                        imageLoader = context.images,
                                        modifier = Modifier.size(48.dp),
                                    )
                                }
                                Text(name, style = ShareTypography.group)
                            }
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                ShareTextButton(
                                    onClick = { commands.openPeer(player.text("charUuid")) }
                                ) {
                                    Text("Чат и вызовы")
                                }
                                if (player["canOpenSheet"] == JsonPrimitive(true))
                                    ShareTextButton(
                                        onClick = {
                                            close()
                                            openCharacter(player.text("charUuid"))
                                        }
                                    ) {
                                        Text("Открыть лист")
                                    }
                                if (context.canEdit)
                                    ShareTextButton(
                                        onClick = {
                                            close()
                                            context.edit("money-transfer")
                                        }
                                    ) {
                                        Text("Передать деньги")
                                    }
                            }
                        }
                    }
            } else {
                if (ui.transfers.isEmpty() && ui.pending.isEmpty()) SheetEmpty("Новых событий нет")
                ui.transfers.forEach { transfer ->
                    ShareTile(framed = false) {
                        Text(
                            transfer.text("itemName").ifBlank { "Предмет" },
                            style = ShareTypography.group,
                        )
                        Text(transfer.text("senderName"), style = ShareTypography.context)
                        if (transfer.text("recipientCharUuid") == context.uuid)
                            Row {
                                ShareTextButton(
                                    onClick = {
                                        commands.resolveTransfer(
                                            transfer["id"]?.jsonPrimitive?.long
                                                ?: return@ShareTextButton,
                                            "accept",
                                        )
                                    },
                                    enabled = !ui.busy,
                                ) {
                                    Text("Принять")
                                }
                                ShareTextButton(
                                    onClick = {
                                        commands.resolveTransfer(
                                            transfer["id"]?.jsonPrimitive?.long
                                                ?: return@ShareTextButton,
                                            "reject",
                                        )
                                    },
                                    enabled = !ui.busy,
                                ) {
                                    Text("Отклонить")
                                }
                            }
                        else
                            ShareTextButton(
                                onClick = {
                                    commands.resolveTransfer(
                                        transfer["id"]?.jsonPrimitive?.long
                                            ?: return@ShareTextButton,
                                        "reject",
                                    )
                                },
                                enabled = !ui.busy,
                            ) {
                                Text("Отозвать")
                            }
                    }
                }
                ui.pending.forEach { event -> InteractionView(event, context.uuid, commands) }
            }
        }
    }
}

@Composable
private fun InteractionView(
    event: JsonObject,
    uuid: String,
    commands: CharacterCampaignController,
) {
    val data = event["data"].objectValue()
    val id = event["id"]?.jsonPrimitive?.longOrNull ?: return
    ShareTile(framed = false) {
        Text(data.text("senderName").ifBlank { "Сообщение" }, style = ShareTypography.group)
        if (event.text("type") == "chat_message")
            Text(data.text("message"), style = ShareTypography.context)
        else {
            val incoming = data.text("recipientCharUuid") == uuid
            when (data.text("status")) {
                "pending" -> {
                    Text(
                        if (incoming) "Вас вызывают в камень / ножницы / бумага"
                        else "Вызов отправлен",
                        style = ShareTypography.context,
                    )
                    Row {
                        if (incoming) {
                            ShareTextButton(
                                onClick = { commands.resolveInteraction(id, "accept") }
                            ) {
                                Text("Принять")
                            }
                            ShareTextButton(
                                onClick = { commands.resolveInteraction(id, "decline") }
                            ) {
                                Text("Отклонить")
                            }
                        } else
                            ShareTextButton(
                                onClick = { commands.resolveInteraction(id, "cancel") }
                            ) {
                                Text("Отозвать")
                            }
                    }
                }
                "choosing" -> {
                    val ready =
                        data[if (incoming) "recipientReady" else "senderReady"] ==
                            JsonPrimitive(true)
                    Text(
                        if (ready) "Ваш ход выбран. Ожидаем соперника." else "Выберите ход",
                        style = ShareTypography.context,
                    )
                    if (!ready)
                        FlowRow {
                            listOf("rock" to "Камень", "scissors" to "Ножницы", "paper" to "Бумага")
                                .forEach { (key, label) ->
                                    ShareTextButton(
                                        onClick = { commands.resolveInteraction(id, key) }
                                    ) {
                                        Text(label)
                                    }
                                }
                        }
                }
                "declined" -> Text("Вызов отклонён")
                "cancelled" -> Text("Вызов отозван")
                else -> {
                    val names =
                        mapOf("rock" to "Камень", "scissors" to "Ножницы", "paper" to "Бумага")
                    Text(
                        "${names[data.text("senderChoice")].orEmpty()} / ${names[data.text("recipientChoice")].orEmpty()}"
                    )
                    Text(
                        if (data.text("winnerCharUuid").isBlank()) "Ничья"
                        else if (data.text("winnerCharUuid") == uuid) "Вы победили"
                        else "Победил соперник"
                    )
                }
            }
        }
    }
}
