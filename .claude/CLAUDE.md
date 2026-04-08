# Stampede — Agent Instructions

You are working in the Stampede load testing tool. Stampede uses k6 to run load tests against web applications.

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
# Local (requires k6 installed)
k6 run patterns/smoke.js

# Via run.sh (auto-activates profile)
STAMPEDE_PROFILE=myapp STAMPEDE_PATTERN=smoke ./run.sh

# Docker
docker build -t stampede -f Dockerfile .
docker run --rm -e STAMPEDE_PROFILE=myapp -e STAMPEDE_PATTERN=smoke stampede
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `STAMPEDE_PROFILE` | Profile name (used by `run.sh` to symlink `target.js`) |
| `STAMPEDE_PATTERN` | Pattern name (used by `run.sh`) |
| `STAMPEDE_MAX_VUS` | Override peak VU count |
| `STAMPEDE_DURATION` | Override test duration |
| `STAMPEDE_BASE_URL` | Override profile's base URL |
| `STAMPEDE_AUTH_STRATEGY` | Override auth strategy (`form_login`, `hmac`, `api_key`, `bearer`, `none`) |
| `EMAIL`, `PASSWORD` | Credentials for `form_login` auth |
| `LESSON_ID`, `INST_DOMAIN`, `HMAC_SECRET` | Parameters for `hmac` auth |
| `API_KEY` | Key for `api_key` auth |
| `AUTH_TOKEN` | Token for `bearer` auth |

## File Editing Guidelines

- Keep all JS files under 200 lines.
- Follow k6 module conventions (`import`/`export`, `__ENV` for env vars, `export const options` for test config).
- Test changes with `k6 run --dry-run patterns/smoke.js` when possible.
