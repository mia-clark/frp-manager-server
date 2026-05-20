# frpmgr-server

Headless FRP client manager — manages multiple `frpc` instances inside a single Linux process, exposes the full management surface over HTTP + WebSocket. Designed for Docker.

> Forked from the Windows GUI tool [frpmgr](https://github.com/mia-clark/frp-manager-server). The Windows GUI is gone; the configuration model, hot-reload, and frpc embedding are kept. See [`docs/superpowers/specs/2026-05-20-frpmgr-docker-migration-design.md`](docs/superpowers/specs/2026-05-20-frpmgr-docker-migration-design.md) for the migration rationale.

## What it gives you

- **Multi-instance frpc** in one process (goroutines, not separate containers)
- **Hot reload** without losing proxy state — same `svc.Reload` path the original GUI used
- **Full REST API** covering config / proxy CRUD, lifecycle (start/stop/reload), validation, import/export, NAT-hole discovery
- **WebSocket event stream** for state changes, proxy status diffs, errors, and live log tail
- **Bearer-token auth** (single static token via env var) + configurable CORS
- **OpenAPI 3.1** description ready to feed Swagger Codegen / openapi-typescript

The intended client is your own React/Vue webui — the API is built to be browser-friendly.

## Quick start

```bash
cd deploy/
cp .env.example .env
# Generate a strong token and paste it into .env
openssl rand -hex 32

docker compose up -d --build
curl http://localhost:8080/api/v1/health
```

See **[`docs/README-server.md`](docs/README-server.md)** for the full deployment & API guide.

## Repo layout

```
cmd/frpmgrd/        # daemon entrypoint
internal/api/       # HTTP + WebSocket handlers, middleware
internal/manager/   # instance registry + lifecycle (replaces Windows SCM)
internal/eventbus/  # in-process pub/sub for WS push
internal/logtail/   # tail -f for log files
internal/appcfg/    # env var parsing
pkg/config/         # FRP config model (INI/TOML, V1 conversion)
pkg/consts/         # protocol/proxy type constants
pkg/util/           # cross-platform helpers (file IO, strings)
pkg/sec/            # password hashing
pkg/version/        # version stamps
services/           # FrpClientService wrapper (unchanged from upstream)
deploy/             # Dockerfile, docker-compose.yml, .env.example
docs/api/           # OpenAPI spec
docs/superpowers/   # design spec + implementation plan
```

## Building

```bash
make build          # Linux static binary -> bin/frpmgrd
make build-host     # native (e.g. Windows for local dev) -> bin/frpmgrd
make test           # go test ./...
make docker         # docker build using deploy/Dockerfile
```

## Status

| Milestone | What | Status |
|---|---|---|
| M1 | Scaffolding (cleanup, http server, /health) | done |
| M2 | Manager + configs/proxies CRUD + lifecycle | done |
| M3 | EventBus + WebSocket /events + log tail | done |
| M4 | Import/export + AutoDelete + nathole | done |
| M5 | Docker packaging + docs | done |
| M6 | System/container metrics (`/api/v1/system/*`) + per-proxy connection count | done |
| M7 | Embedded Scalar API docs at `/api/docs/` | done |

## License

Same as upstream — see [`LICENSE`](LICENSE).
