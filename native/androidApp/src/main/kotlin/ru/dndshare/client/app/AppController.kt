package ru.dndshare.client.app

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.encodeToString
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*
import ru.dndshare.client.network.*
import ru.dndshare.client.device.DeviceServices

class AppController(val platform: DeviceServices, val api: ApiClient) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val mutable = MutableStateFlow(AppState())
    val state: StateFlow<AppState> = mutable.asStateFlow()
    private var refreshJob: Job? = null
    private var foregroundJob: Job? = null
    private var lastRefresh = 0L
    private var refreshGeneration = 0L
    private var closeMediaCache: (() -> Unit)? = null

    fun registerMediaCache(close: () -> Unit): () -> Unit {
        closeMediaCache = close
        return { if (closeMediaCache === close) closeMediaCache = null }
    }

    private fun releaseMediaCache() {
        closeMediaCache?.invoke()
        closeMediaCache = null
    }

    private val startupJob = scope.launch { boot() }

    private inline fun <reified T> restored(key: String): T? =
        platform.secureStore.read(key)?.let { runCatching { WireJson.decodeFromString<T>(it) }.getOrNull() }

    private suspend fun activate(user: User) {
        require(user.id > 0)
        if (state.value.user?.id != user.id) {
            val previous = state.value.user?.id
            releaseMediaCache()
            state.value.repository?.database?.close()
            if (previous != null) platform.eraseAccount(previous)
            val db = withContext(Dispatchers.IO) { platform.database(user.id) }
            mutable.update { it.copy(user = user, repository = CatalogueRepository(api, db)) }
        } else mutable.update { it.copy(user = user) }
        platform.secureStore.write("user", WireJson.encodeToString(user))
    }

    private suspend fun boot() {
        try {
            if (!api.cookies.hasSession()) {
                forgetSession()
                return
            }
            val cached = restored<User>("user")
            if (cached != null && api.cookies.hasSession()) {
                activate(cached)
                val sources = restored<List<GameSource>>("sources").orEmpty()
                mutable.update { it.copy(sources = sources, booting = false, offline = true) }
                selectInitialContext(cached, sources)
            }
            val current = api.checkAuth()
            if (current == null) forgetSession()
            else {
                activate(current)
                loadSources()
                mutable.update { it.copy(booting = false, offline = false) }
                refresh(force = true)
            }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (error: Exception) {
            if ((error as? ApiException)?.status == 401) forgetSession()
            mutable.update { it.copy(booting = false, offline = true,
                error = if (it.user != null) "Нет связи с сервером. Доступна сохранённая копия." else null) }
        }
        mutable.update { it.copy(booting = false) }
    }

    fun login(login: String, password: String) {
        if (state.value.signingIn) return
        scope.launch {
            mutable.update { it.copy(signingIn = true, authError = null) }
            try {
                activate(api.login(login.trim(), password))
                mutable.update { it.copy(offline = false) }
                loadSources()
                refresh(force = true)
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) {
                if (state.value.user == null) {
                    mutable.update { it.copy(authError = (error as? ApiException)?.message ?: "Не удалось подключиться к серверу.") }
                } else mutable.update { it.copy(error = "Не удалось загрузить данные. Нажмите «Обновить».", offline = true) }
            } finally { mutable.update { it.copy(signingIn = false) } }
        }
    }

    private fun selectInitialContext(user: User, sources: List<GameSource>) {
        val preferred = restored<GameContext>("selection")
        val source = sources.firstOrNull { it.id == (preferred?.sourceId ?: user.gameContext.sourceId) }
            ?: sources.firstOrNull()
        val edition = source?.versions?.firstOrNull { it.id == (preferred?.sourceVersionId ?: user.gameContext.sourceVersionId) }
            ?: source?.versions?.firstOrNull()
        mutable.update { it.copy(sourceId = source?.id ?: user.gameContext.sourceId, editionId = edition?.id ?: user.gameContext.sourceVersionId) }
    }

    private suspend fun loadSources() {
        val sources = api.sources()
        platform.secureStore.write("sources", WireJson.encodeToString(sources))
        mutable.update { it.copy(sources = sources) }
        state.value.user?.let { selectInitialContext(it, sources) }
    }

    fun selectSource(source: GameSource, edition: Edition?) {
        val context = GameContext(source.id, source.name, edition?.id ?: 0, edition?.version.orEmpty())
        platform.secureStore.write("selection", WireJson.encodeToString(context))
        mutable.update { it.copy(sourceId = source.id, editionId = edition?.id ?: 0, error = null) }
        refresh(force = true)
    }

    fun refresh(force: Boolean = false) {
        if (state.value.user == null) return
        if (!force && platform.nowMillis() - lastRefresh < 300_000) return
        refreshJob?.cancel()
        val generation = ++refreshGeneration
        lastRefresh = platform.nowMillis()
        val sourceId = state.value.sourceId
        val repository = state.value.repository ?: return
        refreshJob = scope.launch {
            mutable.update { it.copy(synchronizing = true, received = 0, error = null, characterError = null) }
            try {
                if (state.value.sources.isEmpty()) loadSources()
                try { repository.refreshCharacters() }
                catch (cancelled: CancellationException) { throw cancelled }
                catch (error: Exception) {
                    if ((error as? ApiException)?.status == 401) throw error
                    mutable.update { it.copy(characterError = "Не удалось обновить список персонажей.") }
                }
                val selected = if (sourceId > 0) sourceId else state.value.sourceId
                if (selected > 0) repository.synchronize(selected) { count ->
                    mutable.update { if (it.sourceId == selected) it.copy(received = count) else it }
                }
                mutable.update { it.copy(offline = false, error = null) }
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) {
                if ((error as? ApiException)?.status == 401) forgetSession()
                else mutable.update { it.copy(offline = true,
                    error = (error as? ApiException)?.message ?: "Нет связи с сервером. Доступны сохранённые данные.") }
            } finally {
                if (refreshGeneration == generation) mutable.update { it.copy(synchronizing = false) }
            }
        }
    }

    fun foreground(active: Boolean) {
        foregroundJob?.cancel()
        if (active) {
            refresh()
            foregroundJob = scope.launch { while (isActive) { delay(300_000); refresh() } }
        }
    }

    fun logout() = scope.launch {
        startupJob.cancelAndJoin()
        refreshJob?.cancelAndJoin()
        if (!state.value.offline) withTimeoutOrNull(3_000) { runCatching { api.logout() } }
        forgetSession()
    }

    private suspend fun forgetSession() {
        val userId = state.value.user?.id ?: restored<User>("user")?.id
        val db = state.value.repository?.database
        releaseMediaCache()
        mutable.value = AppState(booting = false)
        api.cookies.clear()
        for (key in listOf("user", "sources", "selection")) platform.secureStore.write(key, null)
        withContext(Dispatchers.IO) {
            db?.close()
            if (userId != null) platform.eraseAccount(userId)
        }
    }

    fun close() {
        scope.cancel()
        releaseMediaCache()
        api.close()
        state.value.repository?.database?.close()
    }
}
