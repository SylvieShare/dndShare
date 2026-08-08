# Deploy & Secrets

## Обязательный workflow после каждой правки

После завершения **каждой осмысленной правки** изменения нельзя оставлять только локально или
накапливать до следующей задачи. Обязательный порядок действий:

1. Запустить подходящие проверки: для фронтенда — `cd frontend && npm run build`, для Go-бэкенда —
   `go build ./... && go vet ./...`.
2. Сразу закоммитить изменение и отправить его в `origin/main`.
3. Сразу после успешного push запустить `./deploy/deploy.sh` и убедиться по выводу скрипта, что
   `dndshare.service` имеет статус `active (running)` и приложение снова слушает `:8080`.

Не пропускать push или деплой, если пользователь прямо не попросил оставить правку локально либо
не выкатывать её на стенд.

> **Порт на Go.** Прод теперь — один статический Go-бинарь (фронт вшит через `go:embed`), а не JAR.
> Деплой: `./deploy/deploy.sh` (собирает фронт в `frontend/target/dist`, вшивает в
> `internal/assets/dist`, кросс-компилит `linux/amd64`, заливает бинарь + `dndshare.service` +
> `dndshare-run.sh`, рестартит systemd). Секреты — по-прежнему из Lockbox через `fetch-secrets.sh`.
> Ниже — исходное описание (JAR/Spring); инфраструктура (VM, Lockbox, nginx) та же.

Prod runs as a bare JAR under **systemd** on a Yandex Cloud VM (`213.165.196.171`, user `sylvieshare`, SSH key `~/.ssh/dndshare`). Secrets come from **Yandex Lockbox** and are fetched on the VM at every service start — they are never in the repo and never travel from the dev machine. Same pattern as the sibling `havenShare` project.

## Files (`deploy/`)

- `fetch-secrets.sh` — runs **on the VM**; pulls the `dndshare-secrets` Lockbox payload (via the VM's attached service account, `yc` or raw metadata API) and writes `~/dndshare.env` (chmod 600).
- `run.sh` — systemd `ExecStart` wrapper: calls `fetch-secrets.sh`, `source`s `~/dndshare.env` into the environment, then `exec java -Dspring.profiles.active=prod -jar ~/dndshare.jar`.
- `dndshare.service` — systemd unit. Holds **non-secret** config as `Environment=` (`DB_URL`, `DB_USER`, `LOCKBOX_SECRET_ID`, `MCP_WRITE_ENABLED`, heap). The DB password and storage/MCP secrets come from Lockbox.
- `setup-vm.sh` — one-time VM bootstrap (JDK 21, jq, yc CLI, `sylvieshare` user, install `run.sh` + `fetch-secrets.sh` into the app user's home, install + enable the unit). These two scripts are installed **once** here, not on every deploy — edit them → re-run `bootstrap-vm.sh` to push the change.
- `bootstrap-vm.sh` — run on Mac once: scp `deploy/` to the VM and run `setup-vm.sh` with sudo.

- `deploy_mac.sh` — build + deploy: `backend/mvnw` builds the bundled jar (frontend + backend → `backend/target/dndshare.jar`), scp **only the jar** to the VM, `systemctl restart dndshare`. Run from anywhere as `./deploy/deploy_mac.sh` (it cd's to repo root itself).

There is no Docker in the prod path — the app is a bare jar under systemd.

## How the app reads secrets

`application.yml` uses `${VAR:default}` everywhere. Prod overrides via the env that `run.sh` sources; the defaults are for local dev only. Keys:
- `DB_URL`, `DB_USER`, `DB_PASSWORD`
- `OBJECT_STORAGE_ACCESS_KEY`, `OBJECT_STORAGE_SECRET_KEY`
- `MCP_AUTH_TOKEN`, `MCP_WRITE_ENABLED`

Local dev: copy `.env.example` → `.env` (gitignored), fill values, `set -a; source .env; set +a` before `bash backend/mvnw spring-boot:run`.

## Lockbox secret

`dndshare-secrets` (Lockbox) holds the **secret** keys only: `DB_PASSWORD`, `OBJECT_STORAGE_ACCESS_KEY`, `OBJECT_STORAGE_SECRET_KEY`, `MCP_AUTH_TOKEN`. The VM's service account needs `lockbox.payloadViewer` on it. Put the secret id into `dndshare.service` as `LOCKBOX_SECRET_ID=` (reading payload by id needs only `payloadViewer`; by name additionally needs `lockbox.viewer` on the folder).

To rotate a value (e.g. the MCP token): update the Lockbox payload, then `sudo systemctl restart dndshare` — `run.sh` re-fetches on every start.

## One-time setup

1. Create the Lockbox secret and grant the VM's SA `lockbox.payloadViewer`.
2. Put its id in `deploy/dndshare.service` (`LOCKBOX_SECRET_ID=`).
3. `VM_HOST=213.165.196.171 ./deploy/bootstrap-vm.sh`.
4. `./deploy/deploy_mac.sh` for each subsequent deploy.

nginx terminates TLS and proxies to the app on `:8080` (config lives on the VM, not in the repo). The `/mcp` endpoint is part of the same app — see `md/features/mcp.md`.
