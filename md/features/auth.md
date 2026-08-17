# Auth

Read this before touching `features/auth`.

Components live in:

- `features/auth/components/UserBox.vue`
- `features/auth/components/UserBoxFormAuth.vue` — header shows only `Войти` / `Регистрация` buttons; both login and registration forms live in `AppModalFrame` (no inline header form on any breakpoint). `mobileOpen` drives the login modal, `regOpen` the registration modal. Submit buttons use `--accent`.
- `features/auth/components/UserBoxInfo.vue`

Auth state is managed by the Pinia `account` store in `frontend/src/stores/account.js`.

The global error-report launcher and inbox are mounted only for authenticated
users. The public character wizard dispatches `dndshare:request-auth` only from
its final create action; `UserBoxFormAuth` opens the regular login modal in
response.
