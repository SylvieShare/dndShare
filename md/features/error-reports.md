# Page Error Reports

The application has a global user-facing flow for pointing at a broken element and sending a short report.

## Frontend flow

`features/error-report/components/ErrorReporter.vue` is mounted once in `App.vue` and is available on every route.

- Start with the fixed error icon or `Alt+Shift+E` (`event.code = KeyE`, so the keyboard layout does not matter). On desktop the **«На странице ошибка»** label expands on hover or keyboard focus; mobile keeps the compact icon.
- The trigger is teleported directly to `body`, outside `#app`, so morph windows can blur `#app` without blurring or trapping the button in their stacking context. Its global overlay layer remains clickable above application modals; it hides only while its own report form or element picker is active.
- While selection mode is active, the element under the pointer is outlined. Click/tap selects it; `Esc` cancels.
- Reporter UI is marked with `data-error-report-ignore`, so the selector cannot accidentally target the button, hint, or form.
- The form uses `html-to-image` to render the selected element with the browser's modern CSS engine, shows the JPEG preview, then sends it with the required description, current `window.location.href`, and element JSON through `features/error-report/api/errorReportApi.js`. Capture is best-effort: unsupported/cross-origin content may produce no screenshot, but does not block the report.
- The element object contains a semantic CSS selector, tag/id/classes, short visible text, selected accessibility attributes, its viewport rect, and viewport size. The selector prefers a unique id or test attribute, then builds a readable tag-and-class ancestry without positional `nth-*` indexes, so admin and MCP consumers can understand the UI area from the locator itself. It deliberately does not contain `outerHTML` or form values.

The public submit endpoint accepts both guests and signed-in users. A valid cookie session is attached as `user_id`; anonymous reports keep it null. Reports start unapproved unless the signed-in reporter has `ERROR_REPORT_AUTO_APPROVE`, in which case the new row is immediately available to MCP.

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/error-reports` | Optional | Create a report from `{ description, pageUrl, element, screenshot? }` |
| GET | `/api/admin-panel/error-reports?limit=200&offset=0` | `ADMIN` | List reports newest first |
| GET | `/api/admin-panel/error-reports/{id}/screenshot` | `ADMIN` | Return the raw attached image |
| PATCH | `/api/admin-panel/error-reports/{id}/approval` | `ADMIN` | Set `{ approved: boolean }` for MCP visibility |
| POST | `/api/admin-panel/error-reports/{id}/messages` | `ADMIN` | Answer the latest AI question with `{ message }` |
| POST | `/api/admin-panel/error-reports/{id}/reopen` | `ADMIN` | Return an archived report to the active queue |
| DELETE | `/api/admin-panel/error-reports/{id}` | `ADMIN` | Permanently delete one report and its conversation |

Limits: description and feedback messages are 1–4000 characters, page URL is 1–2048 characters, and element JSON is up to 16 KiB and must contain a non-empty `selector`. Screenshots accept JPEG, PNG, or WebP data URLs up to 2 MiB decoded.

## Storage

`dndshare.error_report` stores `description`, `page_url`, `element jsonb`, optional `user_id`, optional `screenshot bytea` + MIME type, `approved`, and lifecycle fields: `status` (`OPEN`/`RESOLVED`), optional `resolution`, deployed `resolved_commit_sha`, and `resolved_at`. `dndshare.error_report_message` stores the ordered AI/admin conversation for a report and cascades only on permanent report deletion. An admin message records the answering user when available. The tables and columns are created idempotently from `internal/store/schema.sql`; old rows simply have no screenshot or conversation and remain `OPEN`. The reporter FK is null for guests and the list joins `users.login` for signed-in reporters.

## Admin and MCP

The **«Ошибки страниц»** admin tab displays the description, page URL, reporter, selector, short element text, expandable full JSON, and the AI/admin feedback thread. Filters separate active, waiting, and archived reports. When the AI asks a question, the card is marked as waiting and shows an admin reply form. A resolved card displays its resolution, time, and commit SHA and can be returned to work. Permanent deletion remains an explicit admin-only action for spam or invalid records.

MCP exposes:

- `error_reports_list(limit?, offset?)` — read actionable `OPEN` approved reports with the normal MCP token; includes the complete `messages` history plus lifecycle, reporter, and screenshot metadata. Resolved reports and reports whose latest message is an unanswered AI question are omitted; an admin answer or explicit reopen makes an open report visible again.
- `error_report_screenshot(id)` — read one attached image for an approved report as `{ id, contentType, base64 }` without bloating the list response.
- `error_report_question_create(id, question)` — append a concrete AI question and hide the report from subsequent MCP lists until an admin answers; gated by `MCP_WRITE_ENABLED`.
- `error_report_resolve(id, resolution, commitSha?)` — archive a successfully deployed fix while preserving the report, conversation, resolution, and commit; gated by `MCP_WRITE_ENABLED`.
- `error_report_delete(id)` — deprecated compatibility alias that now archives instead of physically deleting.

## Scheduled automation lease

Scheduled runs coordinate through a singleton database lease exposed by MCP, so the protection works across local checkouts, Git worktrees, and different machines.

1. The first tool call must be `error_report_lock_acquire(ttlMinutes?)`. If it returns `acquired: false`, another run is active and the new run must stop without reading or changing reports.
2. Keep the returned ownership `token` private for the duration of the run. The default lease lifetime is four hours; accepted values are 5–720 minutes.
3. A long-running task can call `error_report_lock_renew(token, ttlMinutes?)` before `expiresAt`.
4. Always finish with `error_report_lock_release(token)`, including runs that find no approved reports or stop after an error.

Acquisition is atomic in PostgreSQL. An expired lease can be replaced by the next run, so an interrupted automation cannot block the queue forever. Only the owner token can renew or release an active lease. All three coordination tools require `MCP_WRITE_ENABLED=true`.
