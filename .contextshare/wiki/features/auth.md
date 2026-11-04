# Auth

Read this before touching `features/auth`.

Components live in:

- `features/auth/components/UserBox.vue`
- `features/auth/components/UserBoxFormAuth.vue` — only `Войти` / `Регистрация` triggers in the sidebar, rail or drawer. They share the transient Pinia controller `frontend/src/stores/authDialog.js`.
- `features/auth/components/AppAuthDialogs.vue` — the single owner of login and registration forms in `AppModalFrame`, credentials, requests, error timers and the `dndshare:request-auth` listener. It is mounted once in `AppNavigationShell`, independently of the drawer and viewport changes. Submit buttons use `--accent`; error motion respects reduced motion and timers/listeners are cleared on unmount.
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

The public character wizard dispatches `dndshare:request-auth` from its create
actions; `AppAuthDialogs` opens the regular login modal and explains that login
or registration is required to create the character. The `clone-character`
reason explains that the clone action must be repeated after signing in.
Both hints survive the switch from login to registration. The controller stores
only the selected dialog and its reason, without persistence or credentials.
Multiple sidebar triggers share one dialog; closing the drawer or resizing the
window keeps the active form and its values. Standalone routes retain their
existing shell boundary and do not mount an additional auth host.

## Формат паролей

Пароли сохраняют текущий формат `$31$` поверх `PBKDF2WithHmacSHA1`. Параметры
нельзя менять при рефакторинге: это нарушит чтение сохранённых хэшей. Проверка
использует независимый фиксированный вектор PBKDF2/SHA1, а не только round-trip.

## Связанные страницы

[Оглавление wiki](../README.md) · [API: авторизация и аккаунт](../api/account.md) · [БД: аккаунты, карты и инфраструктура](../database/platform.md)
