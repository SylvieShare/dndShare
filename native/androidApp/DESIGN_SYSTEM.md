# UI Android

Android использует общий Vue/share-ui интерфейс из [frontend](../../md/frontend.md).
Отдельного пакета Compose UI нет. Общие размеры, цвета, поля, меню, описания,
анимации и три формата окна принадлежат одной веб-реализации.

Системные insets передаются оболочкой в CSS; [android-insets.mjs](../../frontend/scripts/android-insets.mjs)
дополняет safe-area переменные при сборке. Устройство сохраняет поддержку
системного масштаба, клавиатуры, кнопки Back и отключения анимаций.

[Контракт Android](../../md/features/native-client.md) · [Общие токены](../../design/README.md)
