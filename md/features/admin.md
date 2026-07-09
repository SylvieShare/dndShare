# Admin Panel

Admin panel is available at `/admin`, visible in navigation only for users with `ADMIN` role.

## Frontend

Feature lives in `features/admin/`:

```
features/admin/
  api/
    adminApi.js            # users/logs/stats API client
    adminJobsApi.js        # jobs API client
  components/
    AdminStats.vue         # Stats tab — cards with entity counts
    AdminUsers.vue         # Users tab — table with createdAt, roles, add/remove role, password reset
    AdminLogs.vue          # Logs tab — table with delete per-row and delete-all
    AdminJobs.vue          # Jobs tab — available jobs + runs history with live progress
  pages/
    ViewAdmin.vue          # Page: sidebar with tabs (stats/users/logs/jobs) + content area
```

Route: `/admin` → `ViewAdmin.vue`.

Nav link shown only when `accountStore.hasRole('ADMIN')` is true — added in both `HorizontalMenu.vue` (desktop + mobile dropdown) and `AppHeader.vue` (brand mobile menu).

## Backend

Controller: `rest/AdminPanelController.kt`, base path `/api/admin-panel`.

All endpoints require `@UserNeedRole([Role.ADMIN])`.

### Users endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin-panel/users` | All users with their roles and `createdAt` |
| POST | `/api/admin-panel/users/{id}/roles` | Grant role `{ role: "ROLE_NAME" }` |
| DELETE | `/api/admin-panel/users/{id}/roles/{role}` | Revoke role |
| POST | `/api/admin-panel/users/{id}/password` | Reset password `{ password: "..." }` |

### Logs endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin-panel/logs` | All logs, sorted by createdAt desc |
| DELETE | `/api/admin-panel/logs/{id}` | Delete single log |
| DELETE | `/api/admin-panel/logs` | Delete all logs |

### Stats endpoint

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin-panel/stats` | Counts: users, characters, templates, baseItems, userItems, baseSuggests, userSuggests, logs |

### Supporting changes

- `UserRoleRepository` — added `findRolesByAllUsers()`, `addRole(userId, role)`, `removeRole(userId, role)`.
- `UserRoleService` — exposed `getRolesByAllUsers()`, `addRole()`, `removeRole()`.

Role names match the `Role` enum: `ADMIN`, `HANDBOOK_ADMIN`, `TEMPLATE_ADMIN`.

## Jobs (асинхронные задачи)

Long-running admin operations are modeled as **jobs** with progress tracking. The Jobs tab in the admin panel lists available jobs and a history of runs with live progress bars.

### Backend

Infrastructure lives in `base/jobs/`:

- `AdminJob` annotation — marks a class as a discoverable job (`code`, `name`, `description`). Includes `@Component`, so the class is auto-registered as a Spring bean.
- `AdminJobHandler` interface — a job implements `fun run(ctx: JobContext)`.
- `JobContext` — passed into the handler. Exposes:
  - `setTotal(value)` — set/update the total work units (optional; when null, the UI shows just a counter).
  - `progress(value, message?)` / `increment(delta = 1, message?)` — update current progress.
  - `isCancelled` / `checkCancelled()` — cooperative cancellation; the handler should call `checkCancelled()` at safe points.
  - `result: Any?` — assign before returning to persist a JSON result for the run.
- `AdminJobService` — discovers `@AdminJob` beans via `ApplicationContext.getBeansWithAnnotation`, runs them on a fixed pool of 2 daemon threads, throttles progress updates to **at most one DB write every 500 ms**, prevents two simultaneous runs of the same `code`. On startup, any `RUNNING` row left by a previous process is marked `FAILED` with `error = "Прервано рестартом приложения"`.
- `JobRunRepository` — manual `NamedParameterJdbcTemplate` repository writing to `base.job_run` (jsonb `result`).

DDL: `resources/job_run.sql`. Table `base.job_run` with columns: `id, code, name, status, current_value, total_value, message, error, result jsonb, started_by_user_id, started_at, finished_at`.

Job implementations live in `com.sylvieshare.dndshare.jobs`:

- `BestiaryImportJob` (`code = "bestiary-import"`) — imports creatures from ttg.club into the enemy items handbook. Replaces the deleted `BestiaryImportController` / `GET /api/admin/import-bestiary`.
- `RecountJob` (`code = "recount"`) — recalculates `count_items` for `item_type`, `source`, `suggest_type`. Replaces the deleted `GET /api/admin/recount`.

### Adding a new job

1. Create a class in `com.sylvieshare.dndshare.jobs` annotated with `@AdminJob(code, name, description)` implementing `AdminJobHandler`.
2. Inject dependencies via constructor.
3. In `run(ctx)`, call `ctx.setTotal(...)` if total is known, then drive progress with `ctx.progress(...)` / `ctx.increment(...)`. Call `ctx.checkCancelled()` at safe boundaries. Optionally assign `ctx.result = ...` for a JSON payload.
4. That's it — Spring picks it up, frontend lists it automatically.

### REST endpoints

All under `/api/admin-panel/jobs`, all require `@UserNeedRole([Role.ADMIN])`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/jobs/available` | List of registered jobs `[{ code, name, description }]` |
| GET | `/jobs` | Recent runs (default 50, sorted by `started_at` desc) |
| GET | `/jobs/{id}` | Single run |
| POST | `/jobs/{code}/start` | Start a job; 500 if another run with same code is `RUNNING` |
| POST | `/jobs/{id}/cancel` | Soft cancel (sets flag; handler exits at next `checkCancelled`) |

### Frontend

`AdminJobs.vue` renders:

- Top: cards for available jobs with a launch button (disabled while a run with same code is `RUNNING`).
- Bottom: runs history table with status chip, progress bar (`current/total (NN%)` when `total != null`, otherwise just `current`), message, duration, cancel button for running rows, and a collapsible result/error block.

Polling: while at least one run is `RUNNING`, the page polls `GET /jobs` every 1.5 s; polling stops automatically when no runs are active.
