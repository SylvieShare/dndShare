# Android-приложение DnD Share

Один модуль `androidApp` на Kotlin и Jetpack Compose: вход, меню, локальный
справочник и список персонажей. Сервером остаётся основной Go API.
Поведение описывает [контракт клиента](../md/features/native-client.md).

## Окружение

Android Studio открывает папку `native`. Нужны JBR из Android Studio,
Android SDK 37 и platform-tools. Kotlin, AGP, Compose BOM, Room, Ktor и Coil
закреплены в Gradle scripts, Gradle wrapper — версией и checksum.

На текущем Windows-компьютере инструменты находятся на диске C:

- Android Studio: `C:\Program Files\Android\Android Studio`;
- SDK: `%LOCALAPPDATA%\Android\Sdk`;
- Gradle cache: `%USERPROFILE%\.gradle`.

SDK задаётся окружением или игнорируемым `local.properties`.
Для сборки APK достаточно JBR Android Studio.
Минимальная версия приложения — Android 8.0 (API 26), target/compile —
Android 17 (API 37). Источник этих значений — `androidApp/build.gradle.kts`.

## Сборка и тесты

Из PowerShell в корне репозитория:

```powershell
.\scripts\native\build.ps1 -Target All
.\scripts\native\build.ps1 -Target Android
.\scripts\native\build.ps1 -Target Test
.\scripts\native\build.ps1 -Target DeviceTest
```

`All` выполняет unit-тесты, Android lint и собирает debug APK. `DeviceTest` требует запущенного
эмулятора (по умолчанию `emulator-5554`, выбор через `-DeviceSerial`) и выполняет
instrumented-тесты Room/SQLite, HTTP и отмены проверки
сессии при выходе. Unit-тесты проверяют поиск, форматы окна, содержимое
описаний, данные персонажей и cookie-контракт. В `src/testSupport` находится
общая фикстура тестовых device services. `DeviceTest` ограничен выбранным
эмулятором и не затрагивает подключённый телефон.

Артефакт: `androidApp/build/outputs/apk/debug/androidApp-debug.apk`.
Это пробная установка с debug-подписью; production-подпись и публикация в store
оформляются отдельно. Скрипт нормализует `PATHEXT` только текущего процесса при
запуске из WSL.

## Установка и обновление телефона

Один раз включить на телефоне параметры разработчика и «Отладку по USB»,
подключить USB-кабель с передачей данных, разблокировать экран и подтвердить
запрос доверия этому компьютеру. Готовые устройства видны командой:

```powershell
.\scripts\native\install.ps1 -ListDevices
```

Обновление собирает текущие исходники, устанавливает APK поверх приложения
через `adb install -r` и запускает его:

```powershell
.\scripts\native\install.ps1
.\scripts\native\install.ps1 -Serial SERIAL_FROM_ADB
```

Без `Serial` выбирается единственный подключённый авторизованный телефон;
эмулятор автоматически не выбирается. При нескольких устройствах нужно
указать цель. `-NoLaunch` устанавливает без запуска. Работает и с уже
подключённым по Wi-Fi ADB-устройством.

Обычное обновление сохраняет локальную базу, кеш и вход в аккаунт при той же
подписи APK. Скрипт останавливается при конфликте подписи и не удаляет приложение
или его данные. Ключ debug-подписи хранится локально в `%USERPROFILE%\.android`;
в Git его не добавляют. Будущие изменения схемы Room сопровождаются миграциями.
По явной команде пользователя «обнови приложение на телефоне» агент выполняет
этот скрипт для доступного телефона; выбор уточняется только при неоднозначной цели.

## Проверка с настоящим сервером

`-ApiBaseUrl http://127.0.0.1:<port>` или `http://10.0.2.2:<port>` разрешён
для локального теста. Такой APK получает ID `ru.dndshare.client.smoke`.
Обычная сборка использует `https://dndshare.ru`.

`TestNativeClientSmokePostgres` с `DNDSHARE_NATIVE_SMOKE=1` поднимает настоящий
Go API и изолированный PostgreSQL. `scripts/native/smoke.py` собирает и
проверяет APK через ADB: форму с клавиатурой, вход и «Назад», 205 записей,
ленивое изображение, персонажи,
сохранение вкладок, перезапуск без сети, три ширины окна, delta и выход.
Нужен уже запущенный AVD; по умолчанию `emulator-5554`, переопределяется
`DNDSHARE_ANDROID_SERIAL`. Пользователь Windows для SDK задаётся
`DNDSHARE_WINDOWS_USER`. Сценарий разрешён только на эмуляторе.

Скрипт использует временный `adb reverse` для связи из эмулятора с Go API в WSL
и восстанавливает размер/плотность AVD. После smoke обычную сборку запускают
без `ApiBaseUrl`, чтобы получить APK основного приложения. Production-аккаунты
для автоматической проверки не используются.

[README проекта](../README.md) · [Проверки](../md/testing.md)
