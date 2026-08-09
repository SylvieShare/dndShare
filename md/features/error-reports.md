# Page Error Reports

The application has a global user-facing flow for pointing at a broken element and sending a short report.

## Frontend flow

`features/error-report/components/ErrorReporter.vue` is mounted once in `App.vue` and is available on every route.

- Start with the fixed error icon or `Alt+Shift+E` (`event.code = KeyE`, so the keyboard layout does not matter). On desktop the **«На странице ошибка»** label expands on hover or keyboard focus; mobile keeps the compact icon.
- The trigger is teleported directly to `body`, outside `#app`, so morph windows can blur `#app` without blurring or trapping the button in their stacking context. Its global overlay layer remains clickable above application modals; it hides only while its own report form or element picker is active.
- While selection mode is active, the element under the pointer is outlined. Click/tap selects it; `Esc` cancels.
- Reporter UI is marked with `data-error-report-ignore`, so the selector cannot accidentally target the button, hint, or form.
- The wide form requires a short title and detailed description. It uses `html-to-image` to render both the selected element crop and the visible viewport. Each JPEG preview occupies its own row and uses the full available form width, capped by the image's intrinsic width, before the form sends it with the current `window.location.href` and element JSON through `features/error-report/api/errorReportApi.js`. The crop has **Меньше/Больше** controls: users can move from the exact element to as many as three parent containers, then move back. A wider crop outlines the exact selected element and stores `screenshotContextLevel`/`screenshotContextSelector` in the element metadata. Each capture is best-effort and independent.
- The element object contains a semantic CSS selector, tag/id/classes, short visible text, selected accessibility attributes, its viewport rect, and viewport size. The selector prefers a unique id or test attribute, then builds a readable tag-and-class ancestry without positional `nth-*` indexes, so admin and MCP consumers can understand the UI area from the locator itself. It deliberately does not contain `outerHTML` or form values.

The public submit endpoint accepts both guests and signed-in users. A valid cookie session is attached as `user_id`; anonymous reports keep it null. Reports start unapproved unless the signed-in reporter has `ERROR_REPORT_AUTO_APPROVE`, in which case the new row is immediately available to MCP.

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/error-reports` | Optional | Create a report from `{ title, description, pageUrl, element, screenshot?, viewportScreenshot? }` |
| GET | `/api/error-report-review/reports?limit=500` | `ERROR_REPORT_REVIEWER` or `ADMIN` | Poll non-archived reports; expired finished rows are archived first |
| GET | `/api/error-report-review/reports/{id}/screenshot` | `ERROR_REPORT_REVIEWER` or `ADMIN` | Return the element crop for a non-archived report |
| GET | `/api/error-report-review/reports/{id}/viewport-screenshot` | `ERROR_REPORT_REVIEWER` or `ADMIN` | Return the page-context image for a non-archived report |
| POST | `/api/error-report-review/reports/{id}/messages` | `ERROR_REPORT_REVIEWER` or `ADMIN` | Answer the latest AI question |
| POST | `/api/error-report-review/reports/{id}/archive` | `ERROR_REPORT_REVIEWER` or `ADMIN` | Archive a finished report immediately |
| POST | `/api/error-report-review/reports/{id}/serious-approval` | `ADMIN` | Approve a serious proposed change |
| GET | `/api/admin-panel/error-reports?limit=200&offset=0` | `ADMIN` | List reports newest first |
| GET | `/api/admin-panel/error-reports/{id}/screenshot` | `ADMIN` | Return the selected-element crop |
| GET | `/api/admin-panel/error-reports/{id}/viewport-screenshot` | `ADMIN` | Return the visible-page screenshot |
| PATCH | `/api/admin-panel/error-reports/{id}/approval` | `ADMIN` | Set `{ approved: boolean }` for MCP visibility |
| POST | `/api/admin-panel/error-reports/{id}/messages` | `ADMIN` | Answer the latest AI question with `{ message }` |
| POST | `/api/admin-panel/error-reports/{id}/reopen` | `ADMIN` | Return a finished or archived report to the active queue |
| DELETE | `/api/admin-panel/error-reports/{id}` | `ADMIN` | Permanently delete one report and its conversation |

Limits: title is 1–160 characters, description and feedback messages are 1–4000 characters, page URL is 1–2048 characters, and element JSON is up to 16 KiB and must contain a non-empty `selector`. Each screenshot accepts a JPEG, PNG, or WebP data URL up to 2 MiB decoded. During rolling deploys, an older frontend that omits `title` gets a server-generated title from the first description line.

## Storage

`dndshare.error_report` stores `title`, `description`, `page_url`, `element jsonb`, optional `user_id`, an optional selected-element crop and visible-viewport image, `approved`, and lifecycle fields. Status moves through `OPEN → RESOLVED → ARCHIVED`: MCP resolution marks a report finished, reviewers see it for one hour, and polling then archives it automatically unless a reviewer clicks × first. Serious-change fields store the AI reason, request time, ADMIN approval time, and approving user. `dndshare.error_report_message` stores the ordered AI/human conversation and cascades only on permanent deletion.

## Admin and MCP

Users with `ERROR_REPORT_REVIEWER` get a global floating inbox above the report button on every page. The button morphs into a panel that grows upward without internal scrollbars and renders at most eight reports; overflow is summarized below the list. With no reports it becomes a disabled **Список пуст** indicator, and an open panel collapses automatically when its last row disappears. It still polls once per second, but applies a completed response atomically and only when its payload changed. Each row expands description/page/selector inline on hover, avoiding a side popover. The extra-wide report modal renders element and viewport screenshots at full available width before the conversation. Finished reports remain visible for one hour and have a quick archive ×. The `ADMIN` role is additionally required for the serious-change confirmation button; reviewer access alone cannot approve it.

The **«Ошибки страниц»** admin tab remains the full management surface: approval for MCP, screenshots, active/waiting/finished/archive filters, feedback, serious-change approval, reopen and permanent deletion.

MCP exposes:

- `error_reports_list(limit?, offset?)` — read actionable `OPEN` approved reports with title and complete metadata. Finished reports, unanswered AI questions, and serious changes awaiting ADMIN approval are omitted.
- `error_report_screenshot(id, kind?)` — read an attached image for an approved report as native MCP image content without embedding base64 in the text response. `kind=element` (default) returns the crop and `kind=viewport` returns the surrounding page context.
- `error_report_question_create(id, question)` — append a concrete AI question and hide the report from subsequent MCP lists until an admin answers; gated by `MCP_WRITE_ENABLED`.
- `error_report_serious_change_request(id, reason)` — pause work that changes schema, authorization, security, data semantics, infrastructure, or another high-impact area until an `ADMIN` confirms it; gated by `MCP_WRITE_ENABLED`.
- `error_report_resolve(id, resolution, commitSha?)` — mark a successfully deployed fix as `RESOLVED`; it remains in the reviewer inbox for one hour before archival.
- `error_report_delete(id)` — deprecated compatibility alias that marks a report finished instead of physically deleting it.

## Scheduled automation lease

Scheduled runs coordinate through a singleton database lease exposed by MCP, so the protection works across local checkouts, Git worktrees, and different machines.

1. Before reading project files, make one lightweight `error_reports_list` call. An empty queue can exit immediately without taking a lease or loading repository context.
2. When the initial list is non-empty, call `error_report_lock_acquire(ttlMinutes?)` before reading or changing the repository. If it returns `acquired: false`, another run is active and the new run must stop.
3. Keep the returned opaque `leaseId` for the duration of the run. The default lease lifetime is 45 minutes; accepted values are 5–120 minutes. Repeat `error_reports_list` after acquisition and use that current snapshot, because the queue may have changed between the first read and the lease.
4. Renew with `error_report_lock_renew(leaseId, ttlMinutes?)` before tests, push, and deploy, or whenever less than 15 minutes remain.
5. Always finish with `error_report_lock_release(leaseId)`, including runs that find no approved reports after acquisition or stop after an error.

Acquisition is atomic in PostgreSQL. An expired lease can be replaced by the next run, so an interrupted automation cannot block the queue forever. Only the matching opaque handle can renew or release an active lease. All three coordination tools require `MCP_WRITE_ENABLED=true`.
