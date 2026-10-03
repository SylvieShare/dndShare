# API: авторизация и аккаунт

Сессии пользователя, настройки аккаунта, обучение и инструменты мастера.

← [HTTP API](../api.md)

## Авторизация

- `POST /api/user/auth`
- `GET /api/user/checkAuth`
- `POST /api/user/logout`
- `POST /api/user/registration`

Успешные `POST /api/user/auth` и `GET /api/user/checkAuth` возвращают в `user`
`gameContext:{sourceId,sourceName,sourceVersionId,version}` вместе с id, login и
roles, а также `hasCharacters` — признак наличия хотя бы одного неудалённого
персонажа у пользователя.
Login ограничен по паре client IP/login, registration — по client IP; превышение
лимита возвращает `429` и `Retry-After`. Смена пароля отзывает прежние server
sessions и выдаёт текущему браузеру новый token.

## Аккаунт игрока

- `PUT /api/account/password` принимает
  `{currentPassword,newPassword}`, проверяет текущий пароль и заменяет его
  PBKDF2-хэшем; ответ без тела — `204`.
- `PUT /api/account/game-context` принимает `{sourceVersionId}`, проверяет
  существование редакции, сохраняет выбор текущему игроку и возвращает
  `{gameContext:{sourceId,sourceName,sourceVersionId,version}}`.
- `GET /api/account/storage` возвращает личное использование пространства:
  `{usedBytes,fileCount,unknownFileCount,breakdown,files}`. Breakdown содержит
  `kind`, локализованную `label`, `bytes` и `count`; файл содержит
  `source,id,kind,name,fileSize?,mimeType?,url?,createdAt`.

Для старых S3-объектов без сохранённого размера endpoint выполняет `HEAD` с
ограниченным параллелизмом и записывает найденный byte-size в БД. Неизвестный
размер не считается нулевым и отдельно отражается в `unknownFileCount`.

## Инструменты мастера

`GET /api/master-tools/treasure-pool` требует авторизации. Возвращает обычный
`{items:[Item]}` только для публичного и собственного снаряжения типов
1/2/10/12/13/14/19 с объектом `data.treasure`. Поддерживает стандартные параметры
content scope, включая `sourceVersionId` и `contentSourceIds`. Случайный выбор
и фильтры уровня/редкости выполняет клиент; запрос не выдаёт предметы персонажу.
Полный контракт: [инструменты мастера](../features/master-tools.md).

## Настройки обучения

Авторизованный пользователь: `GET /api/account/tutorials` → `{ tutorials: [] }`.
Запись результата: `PUT /api/account/tutorials` с `{ flowId, sourceKey, device,
revision, status }`; сброс одного результата: `POST /api/account/tutorials/reset`
с `{ flowId, sourceKey, device }`. Обе записи возвращают 204. Пользователь всегда
определяется из cookie-сессии. Поля, источники и правила версий описаны в
[обучении](../features/tutorials.md).

## Связанные страницы

[Оглавление wiki](../README.md) · [HTTP API](../api.md) · [Auth](../features/auth.md) · [БД: аккаунты, карты и инфраструктура](../database/platform.md)
