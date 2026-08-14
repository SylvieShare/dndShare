# Admin panel

`/admin` доступен пользователям с подходящими ролями. Frontend находится в
`frontend/src/features/admin`, Go routes — в `internal/web/admin.go`,
`internal/web/error_reports.go` и `internal/web/jobs*.go`.

## Sections

- статистика;
- пользователи и роли;
- server logs;
- background jobs и история запусков;
- error reports для ADMIN/reviewer.

Актуальные роли: `ADMIN`, `HANDBOOK_ADMIN`,
`ERROR_REPORT_AUTO_APPROVE`, `ERROR_REPORT_REVIEWER`. Роли управления
шаблонами нет: character settings находятся в frontend code registry.

## Users and logs

`internal/web/admin.go` регистрирует endpoints управления ролями, сброса
пароля, просмотра/удаления logs и статистики. Опасные операции подтверждаются
через общий `ConfirmDialog`; browser confirm/alert не используется.

## Jobs

Реестр `internal/web/jobs.go` получает jobs через `registerJob(code, name,
description, handler)`. Реализации разделены по `jobs_handlers.go` и
`job_*.go`; `job_run` хранит историю, progress, result/error и cooperative
cancellation.

В актуальном реестре:

- `recount` — пересчитывает counts справочника;
- `bestiary-import` — импортирует/обновляет бестиарий; изображение существа
  регистрируется как системная растровая иконка item, отдельно от rules JSON.

Одноразовых jobs по преобразованию форматов персонажа, bindings или spell
classes нет. Такие изменения выполняются идемпотентно в
соответствующем `internal/store/schema/*.sql`, после чего старый формат
удаляется.

Чтобы добавить регулярную job:

1. реализовать handler с `context.Context` и progress reporter;
2. зарегистрировать его в `init()` через `registerJob`;
3. не дублировать migration, которую должен выполнять startup schema;
4. проверить cancellation и отображение result/error в `AdminJobs.vue`.

## Error reports

Admin может одобрить заявку для MCP, ответить на вопрос, подтвердить серьёзное
изменение, вернуть завершённую заявку в работу или удалить её физически.
Reviewer видит отдельную очередь и может архивировать результат. Подробный
state machine — в `md/features/error-reports.md`.
