package ru.dndshare.client.network

import io.ktor.client.call.*
import io.ktor.client.request.*
import io.ktor.client.request.forms.*
import io.ktor.http.*
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*

suspend fun ApiClient.uploadCharacterImage(file: File, iconPurpose: Boolean = false): JsonObject =
    withContext(Dispatchers.IO) {
        require(file.isFile && file.length() in 1..(5L * 1024 * 1024)) {
            "Изображение должно быть не больше 5 МБ."
        }
        val type = if (file.extension.equals("webp", true)) "image/webp" else "image/png"
        with(this@uploadCharacterImage) {
            client
                .submitFormWithBinaryData(
                    "$baseUrl/api/storage/images",
                    formData {
                        if (iconPurpose) append("purpose", "character_icon")
                        append(
                            "file",
                            file.readBytes(),
                            Headers.build {
                                append(HttpHeaders.ContentType, type)
                                append(
                                    HttpHeaders.ContentDisposition,
                                    "filename=\"portrait.${file.extension}\"",
                                )
                            },
                        )
                    },
                )
                .checked()
                .body<JsonObject>()
        }
    }

suspend fun ApiClient.setCharacterIcon(uuid: String, file: File?): JsonObject =
    withContext(Dispatchers.IO) {
        with(this@setCharacterIcon) {
            if (file == null)
                client.delete("$baseUrl/api/char/$uuid/icon-image").checked().body<JsonObject>()
            else {
                require(file.isFile && file.length() in 1..(5L * 1024 * 1024)) {
                    "Иконка должна быть не больше 5 МБ."
                }
                client
                    .submitFormWithBinaryData(
                        "$baseUrl/api/char/$uuid/icon-image",
                        formData {
                            append(
                                "file",
                                file.readBytes(),
                                Headers.build {
                                    append(HttpHeaders.ContentType, "image/png")
                                    append(HttpHeaders.ContentDisposition, "filename=\"icon.png\"")
                                },
                            )
                        },
                    )
                    .checked()
                    .body<JsonObject>()
            }
        }
    }
