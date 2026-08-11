# dndShare

Веб-приложение для листов персонажей, справочника, игровых сессий и музыки.
Production artifact — один статический Go-бинарь с вшитым Vue frontend.

## Stack

- Go `net/http` + `ServeMux`;
- PostgreSQL через pgx;
- S3-compatible object storage через aws-sdk-go-v2;
- Vue 3, Pinia, vue-router, Vite;
- JSON-RPC MCP endpoint `/mcp`.

## Layout

```text
main.go             startup and graceful shutdown
internal/config     environment configuration
internal/store      PostgreSQL, schema.sql, feature queries
internal/storage    object-storage client
internal/web        HTTP routes, middleware, jobs and MCP
internal/assets     embedded frontend build
frontend            Vue application
md                  current project wiki
deploy              systemd/Lockbox deployment
```

Database schema and canonical data migrations run idempotently from
`internal/store/schema.sql` at startup. Runtime code supports only the current
data/API contract; breaking changes migrate stored data rather than keeping
fallback readers.

## Local development

```bash
cd frontend
npm install
npm run dev
```

In another terminal:

```bash
set -a
source .env
set +a
go run .
```

Vite runs on `:5173` and proxies `/api` and `/mcp` to Go on `:8080`.

## Checks

```bash
GOCACHE=/private/tmp/dndshare-go-cache go test ./...
GOCACHE=/private/tmp/dndshare-go-cache go build ./...
GOCACHE=/private/tmp/dndshare-go-cache go vet ./...
cd frontend && npm test -- --run && npm run build
```

## Deploy

```bash
./deploy/deploy.sh
```

See `md/frontend.md`, `md/database.md` and `md/deploy.md` for architecture and
workflow details.
