# API сообщений об ошибках

Поведение и переходы состояний: [сообщения об ошибках](../features/error-reports.md).
Общие ошибки и cookie-auth: [HTTP API](../api.md).

## Отправка

`POST /api/error-reports` принимает гостя или пользователя. JSON:
`{description,pageUrl,element,screenshot?,viewportScreenshot?,title?}`.
`element` — объект с непустым `selector`; остальные поля являются диагностикой.
Ответ `201` — сохранённая заявка. Автор определяется серверной сессией;
`userId`, `approved` и статус из входного JSON не принимаются.

Описание и сообщения содержат 1–4000 символов, заголовок — 1–160, URL — 1–2048;
element ограничен 16 KiB. Снимки — data URL JPEG/PNG/WebP, до 2 MiB декодированных
байтов каждый; MIME проверяется по сигнатуре. Списки возвращают признаки
`hasScreenshot`/`hasViewportScreenshot`, а не сами байты.

## Обзор проверяющего

Основа: `/api/error-report-review/reports`. Доступ — ADMIN или
`ERROR_REPORT_REVIEWER`, кроме указанного отдельно подтверждения.

| Метод и суффикс | Результат |
| --- | --- |
| `GET ?limit=500` | `{reports:[]}` — неархивные заявки, максимум 500 |
| `GET /{id}/screenshot` | Байты выбранной области |
| `GET /{id}/viewport-screenshot` | Байты дополнительного снимка страницы |
| `POST /{id}/messages` | `{message}`; ответ `201` — созданное сообщение; без ожидающего вопроса — `409` |
| `POST /{id}/archive` | Архивирование завершённой заявки |
| `POST /{id}/serious-approval` | Подтверждение запрошенного изменения; только ADMIN |

## Администрирование

Основа: `/api/admin-panel/error-reports`. Все операции требуют ADMIN.

| Метод и суффикс | Результат |
| --- | --- |
| `GET ?limit=200&offset=0` | `{reports:[]}` — все состояния, от новых к старым; limit 1–500 |
| `GET /{id}/screenshot` | Снимок области, включая архив |
| `GET /{id}/viewport-screenshot` | Дополнительный снимок страницы |
| `PATCH /{id}/approval` | `{approved:boolean}` — допуск к обработке |
| `POST /{id}/messages` | `{message}` — ответ на последний вопрос; ответ `201` |
| `POST /{id}/reopen` | Вернуть RESOLVED/ARCHIVED в OPEN, сохранив evidence и сообщения |
| `DELETE /{id}` | Безвозвратно удалить заявку и сообщения |

Жизненный цикл, сообщения, claim и screenshot-флаги входят в DTO. Существующая
заявка без замеров имеет `timing:null`. Иначе `timing` содержит
`phases:[{phase,durationMs}]` в порядке analysis/fix/test/deploy, `totalMs`,
`beforeWorkMs`, `firstStartedAt`, `snapshotAt`, `activePhase`, `activeUntil`,
`intervalCount`. Все длительности — целые миллисекунды. Текущий этап уже включён
до snapshotAt, клиент добавляет только время после снимка, не позднее activeUntil.
После остановки activePhase/activeUntil равны null. Те же поля доступны в MCP get
и compact list; отдельного публичного endpoint записи времени нет.

Неизвестная заявка/недоступное изображение даёт `404`, неподходящий переход — `409` или
`404` по его текущим предусловиям. Изображения отдаются с приватным
`Cache-Control: no-store`, без встраивания в JSON списков.

## Доставка событий на компьютер

`GET /mcp/error-report-events?after=N` — bearer-authenticated SSE, независимо от
cookie пользователя. Формат, replay и cursor описаны в
[контракте локальной доставки](../features/error-report-dispatch.md#сервер).
Авторизация — MCP_AUTH_TOKEN, без токена ответ 401. Поток не содержит описаний,
изображений, ключей сессии или capability lease.
