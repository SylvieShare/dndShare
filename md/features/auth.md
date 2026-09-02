# Auth

Read this before touching `features/auth`.

Components live in:

- `features/auth/components/UserBox.vue`
- `features/auth/components/UserBoxFormAuth.vue` — header shows only `Войти` / `Регистрация` buttons; both login and registration forms live in `AppModalFrame` (no inline header form on any breakpoint). `mobileOpen` drives the login modal, `regOpen` the registration modal. Submit buttons use `--accent`.
- `features/auth/components/UserBoxInfo.vue`

Auth state is managed by the Pinia `account` store in `frontend/src/stores/account.js`.
Its authenticated user projection includes `hasCharacters`, which comes from
the auth API and is updated immediately after character creation or deletion so
global navigation can switch between `Создать персонажа` and `Персонажи`.

Successful login and registration set two persistent `HttpOnly`, `SameSite=Lax`
session cookies with a 30-day `Max-Age`, so authentication survives a browser
restart. The server rejects sessions older than the same 30-day lifetime and
cleans expired rows at startup. Password changes revoke previous sessions.
Logout is a state-changing `POST`, not `GET`, and deletes the current server
session and both cookies. Login is limited per client/login pair; registration is
limited per client IP.

The global error-report launcher and inbox are mounted only for authenticated
users. The public character wizard dispatches `dndshare:request-auth` only from
its final create action; `UserBoxFormAuth` opens the regular login modal in
response and explains that login or registration is required to create the
character. Only the chrome matching the current 640px breakpoint is mounted, so
the mobile header and desktop sidebar cannot open duplicate auth modals.
