# Page Error Reports

The application has a global user-facing flow for pointing at a broken element and sending a short report.

## Frontend flow

`features/error-report/components/ErrorReporter.vue` is mounted once in `App.vue` and is available on every route.

- Start with the fixed **«На странице ошибка»** button or `Alt+Shift+E` (`event.code = KeyE`, so the keyboard layout does not matter).
- While selection mode is active, the element under the pointer is outlined. Click/tap selects it; `Esc` cancels.
- Reporter UI is marked with `data-error-report-ignore`, so the selector cannot accidentally target the button, hint, or form.
- The form sends a required description, the current `window.location.href`, and an element JSON object through `features/error-report/api/errorReportApi.js`.
- The element object contains a CSS selector, tag/id/classes, short visible text, selected accessibility attributes, its viewport rect, and viewport size. It deliberately does not contain `outerHTML` or form values.

The public submit endpoint accepts both guests and signed-in users. A valid cookie session is attached as `user_id`; anonymous reports keep it null.

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/error-reports` | Optional | Create a report from `{ description, pageUrl, element }` |
| GET | `/api/admin-panel/error-reports?limit=200&offset=0` | `ADMIN` | List reports newest first |
| DELETE | `/api/admin-panel/error-reports/{id}` | `ADMIN` | Delete one handled report |

Limits: description 1–4000 characters, page URL 1–2048 characters, element JSON up to 16 KiB and must contain a non-empty `selector`.

## Storage

`dndshare.error_report` stores `description`, `page_url`, `element jsonb`, optional `user_id`, and `created_at`. The table and indexes are created idempotently from `internal/store/schema.sql`.

## Admin and MCP

The **«Ошибки страниц»** admin tab displays the description, page URL, reporter, selector, short element text, and expandable full JSON. It deletes reports one at a time.

MCP exposes:

- `error_reports_list(limit?, offset?)` — read reports with the normal MCP token.
- `error_report_delete(id)` — delete one report; gated by `MCP_WRITE_ENABLED`.
