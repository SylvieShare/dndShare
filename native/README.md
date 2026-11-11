# Android-приложение DnD Share

Android — оболочка Capacitor над тем же Vue-приложением, которое встраивается в Go.
Экранов Compose и отдельной реализации игровых правил больше нет. Карты и 3D
используют общий Three.js/WebGL2. Контракт: [Android-клиент](../md/features/native-client.md).

## Сборка

Нужны Node/npm, JBR Android Studio, SDK 37 и platform-tools на диске C.
Минимум Android 8 (API 26). Версии Capacitor закреплены в frontend/package-lock.json.
Установка зависимостей: из frontend выполнить npm ci.

Из корня в PowerShell:

~~~powershell
.\scripts\native\build.ps1 -Target Android
.\scripts\native\build.ps1 -Target DeviceTest -DeviceSerial emulator-5580 -TestClass ru.dndshare.client.HybridShellTest
~~~

Gradle собирает frontend через Vite и копирует тот же dist в APK. Для APK не нужны
NDK, CMake, Filament, Room, Ktor или отдельные шрифты UI. Сжатые HTTP-копии .gz/.br
в APK не включаются: Android упаковывает исходные веб-ресурсы самостоятельно.
Готовый файл: androidApp/build/outputs/apk/debug/androidApp-debug.apk.

Для установки подготовленного APK используется [install.ps1](../scripts/native/install.ps1)
с ReleaseManifest. Package ID и подпись сохраняются; старые тестовые локальные
таблицы Compose-клиента не импортируются. Первый вход в новую оболочку требует сети.

## Установка и обновление телефона

Включите беспроводную отладку, затем используйте scripts/native/install.ps1
с подготовленным ReleaseManifest и текущим адресом ADB. Скрипт проверяет SHA-256
и устанавливает APK через install -r с сохранением данных.

## Нативная граница

В src/main/java/ru/dndshare/client:

- MainActivity — WebView, локальная раздача интерфейса, API passthrough, insets и Back.
- LocalStorePlugin — SQLite, выбор места экспорта, печать и очистка сессии.
- MediaCache — ограниченный ленивый кеш медиа и моделей.

Сборка не загружает HTML/JS интерфейса с сайта. Origin локального приложения —
https://dndshare.ru; /api использует настоящий HTTPS-сервер и HttpOnly cookies.
Это сохраняет обычные fetch, XHR, загрузки и EventSource без второго HTTP-клиента.
Внешние страницы открываются браузером; приложение не исполняет их в своём bridge.

## Проверки

HybridShellTest проверяет запуск упакованного frontend, origin, SQLite после
пересоздания Activity и доступность WebGL2. Общая функциональность проверяется
узкими браузерными сценариями, а Android — оболочкой и интеграцией устройства.
Физический телефон не используется вместо тестового эмулятора.

## Внешний экран раскладушки

CoverDisplayPlugin — небольшая платформенная интеграция публичного WindowArea API.
WindowManager/window-java закреплены в Gradle. Основной UI и фотографии галереи
остаются общими Vue-компонентами. Второй экран поддерживается только при наличии
capability OPERATION_PRESENT_ON_AREA у прошивки; в остальных случаях меню объясняет
ограничение. Не следует обещать поддержку по одному названию модели телефона.
