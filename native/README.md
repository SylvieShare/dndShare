# Нативные клиенты DnD Share

Android и Windows используют общий Kotlin/Compose Multiplatform модуль
`shared`. Вход, меню, справочник и список персонажей реализованы нативно.
Сервером остаётся основной Go API. Подробности поведения и ограничений —
[контракт клиента](../md/features/native-client.md).

## Инструменты на Windows

Нужны Android Studio с JBR, Android SDK 37 и полный JDK 17+ с `jpackage` для
Windows distribution. Версии Kotlin, Compose, AGP, Room, Ktor и Coil заданы
в Gradle scripts; Gradle wrapper закрепляет версию и checksum дистрибутива.
Android Studio открывает папку `native`, затем выполняет Gradle sync.

Установленное окружение текущего компьютера находится на диске C:

- Android Studio: `C:\Program Files\Android\Android Studio`;
- Android SDK: `%LOCALAPPDATA%\Android\Sdk`;
- JDK для упаковки: `C:\Program Files\Java\jdk-17`;
- Gradle cache: `%USERPROFILE%\.gradle`.

Пути SDK задаются окружением или игнорируемым `local.properties`; путь JDK
для упаковки переопределяется через `JPACKAGE_HOME`. В Git пути пользователя
и содержимое кешей не добавляются.

## Сборка

Из PowerShell в корне репозитория:

```powershell
.\scripts\native\build.ps1 -Target All
.\scripts\native\build.ps1 -Target Android
.\scripts\native\build.ps1 -Target Windows
.\scripts\native\build.ps1 -Target Test
```

`All` выполняет тесты общего кода, собирает debug APK и portable Windows ZIP.
Скрипт нормализует `PATHEXT` только текущего процесса для запуска из WSL.
Подписанный production Android release и публикация в stores требуют отдельных
ключей и процесса выпуска; текущий APK предназначен для установки и проверки.

Артефакты:

- `androidApp/build/outputs/apk/debug/androidApp-debug.apk`;
- `desktopApp/build/distributions/DnDShare-windows-x64-0.1.0.zip`.

ZIP содержит `DnDShare/DnDShare.exe`, библиотеки и собственный Java runtime.
На целевом Windows-компьютере отдельная Java не нужна. Упаковка Windows
выполняется на Windows. Gradle также настроен для задач EXE/MSI installer;
portable ZIP не требует установки и подходит для пробного выпуска.

## Изолированная проверка Android

`-ApiBaseUrl http://10.0.2.2:<port>` разрешён только для локального тестового
сервера. Такой APK получает отдельный application ID `ru.dndshare.client.smoke`.
Обычная сборка использует `https://dndshare.ru`; cleartext разрешён debug
конфигурацией только для loopback/эмулятора.

`TestNativeClientSmokePostgres` с `DNDSHARE_NATIVE_SMOKE=1` запускает настоящий
Go API и изолированную PostgreSQL, затем `scripts/native/smoke.py` собирает,
устанавливает и проверяет APK через ADB. Нужен уже запущенный AVD; по умолчанию
`emulator-5554`, переопределяется `DNDSHARE_ANDROID_SERIAL`. WSL-путь пользователя
SDK задаётся `DNDSHARE_WINDOWS_USER`. Production аккаунты не используются.

После smoke обычную сборку выполняют снова без `ApiBaseUrl`, чтобы получить
APK основного приложения. Скрипт smoke восстанавливает размер и плотность AVD.
Для связи эмулятора с тестовым Go API из WSL он временно использует `adb reverse`
и loopback URL; перенаправление снимается после сценария.

[README проекта](../README.md) · [Проверки](../md/testing.md)
