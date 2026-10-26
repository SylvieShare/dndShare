package ru.dndshare.client.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.*
import androidx.compose.ui.unit.dp
import org.jetbrains.compose.resources.painterResource
import ru.dndshare.client.app.AppState
import ru.dndshare.client.resources.Res
import ru.dndshare.client.resources.brand_mark

@Composable
fun LoginScreen(state: AppState, login: (String, String) -> Unit) {
    var name by rememberSaveable { mutableStateOf("") }
    // Passwords deliberately stay out of saved instance state and preferences.
    var password by remember { mutableStateOf("") }
    val submit = { if (name.isNotBlank() && password.isNotBlank()) login(name, password) }
    Box(Modifier.fillMaxSize().padding(horizontal = 24.dp), contentAlignment = Alignment.Center) {
        Column(
            Modifier.widthIn(max = 420.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(vertical = 40.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            Image(painterResource(Res.drawable.brand_mark), null, Modifier.size(76.dp))
            Text("DnD Share", style = MaterialTheme.typography.headlineLarge)
            Text("Ваши персонажи и справочник — под рукой.",
                color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
            Spacer(Modifier.height(6.dp))
            OutlinedTextField(
                value = name, onValueChange = { name = it.take(128) }, modifier = Modifier.fillMaxWidth(),
                label = { Text("Логин") }, singleLine = true, enabled = !state.signingIn,
                keyboardOptions = KeyboardOptions(autoCorrectEnabled = false, imeAction = ImeAction.Next),
            )
            OutlinedTextField(
                value = password, onValueChange = { password = it.take(256) }, modifier = Modifier.fillMaxWidth(),
                label = { Text("Пароль") }, singleLine = true, enabled = !state.signingIn,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { submit() }),
            )
            if (state.authError != null) Text(state.authError, color = MaterialTheme.colorScheme.error)
            Button(
                onClick = submit,
                enabled = name.isNotBlank() && password.isNotEmpty() && !state.signingIn,
                modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
            ) {
                if (state.signingIn) {
                    CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(10.dp))
                }
                Text(if (state.signingIn) "Входим…" else "Войти")
            }
            Text("Используйте свой аккаунт DnD Share.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
