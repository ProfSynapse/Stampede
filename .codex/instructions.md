# Stampede — Codex Instructions

Stampede is a config-driven k6 load testing tool. It separates **profiles** (target configuration) from **patterns** (test shapes).

## Architecture

- **profiles/** — Target configuration files. Each exports a default config object with `baseUrl`, `auth`, `endpoints`, `thresholds`, and a `contentPath()` named export.
- **patterns/** — Test patterns (spike, stress, etc.). Each imports from `profiles/target.js` and uses `lib/` utilities.
- **lib/** — Shared code: `auth.js` (pluggable auth strategies), `metrics.js` (status tracking), `http.js` (helpers), `websocket.js` (Phoenix LiveView).
- **profiles/target.js** — Symlink to the active profile. Patterns import this. Created by `run.sh` or manually via `ln -sf myprofile.js profiles/target.js`.

## Key Rules

1. **Never commit credentials.** All profiles except `example.js` and `_base.js` are gitignored.
2. **Profiles must export `contentPath`.** Patterns import `{ contentPath }` as a named export.
3. **Auth strategies are in `lib/auth.js`.** Five strategies: `form_login`, `hmac`, `api_key`, `bearer`, `none`.
4. **k6 doesn't support dynamic imports.** Patterns statically import `../profiles/target.js`. Profile selection happens by changing the symlink target.

## Creating a New Profile

1. Copy `profiles/example.js` to `profiles/yourapp.js`
2. Set `baseUrl`, configure `auth` (pick a strategy), define `endpoints`
3. Export `contentPath(template)` if your app has content endpoints with dynamic IDs
4. Activate: `ln -sf yourapp.js profiles/target.js`

## Running Tests

```bash
# CLI (preferred)
./run.sh run --profile myapp --pattern smoke
./run.sh run --profile myapp --pattern spike --max-vus 2000
./run.sh list profiles
./run.sh list patterns

# Direct k6 (requires profile symlink)
k6 run patterns/smoke.js

# Docker
docker build -t stampede -f Dockerfile .
docker run --rm stampede run --profile myapp --pattern smoke
```

## CLI Reference

| Flag | Description |
|------|-------------|
| `--profile <name>` | Profile to activate (required) |
| `--pattern <name>` | Pattern to run (required) |
| `--max-vus <n>` | Override peak VU count |
| `--duration <time>` | Override duration (e.g., `5m`, `30s`) |
| `--base-url <url>` | Override profile's base URL |
| `--auth-strategy <s>` | Override auth strategy |
| `--step <n>` | Step size (breakpoint) |
| `--hold <time>` | Hold duration per step |

## Environment Variables (Secrets Only)

Env vars are for secrets — never pass these as CLI args:

| Variable | Description |
|----------|-------------|
| `EMAIL`, `PASSWORD` | Credentials for `form_login` auth |
| `HMAC_SECRET` | HMAC secret key |
| `ACCESS_TOKEN` | Pre-computed access token |
| `LESSON_ID`, `INST_DOMAIN` | HMAC message parameters |
| `API_KEY` | Key for `api_key` auth |
| `AUTH_TOKEN` | Token for `bearer` auth |

`STAMPEDE_*` env vars (`STAMPEDE_PROFILE`, `STAMPEDE_PATTERN`, `STAMPEDE_MAX_VUS`, etc.) still work as fallbacks but CLI args take precedence.

## File Editing Guidelines

- Keep all JS files under 200 lines.
- Follow k6 module conventions (`import`/`export`, `__ENV` for env vars, `export const options` for test config).
- Test changes with `k6 run --dry-run patterns/smoke.js` when possible.

## Rules

- Never commit credentials. Profiles except example.js are gitignored.
- Profiles must export `contentPath(template)` as a named export.
- k6 has no dynamic imports. Profile selection is via symlink.
