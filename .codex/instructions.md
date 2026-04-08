# Stampede — Codex Instructions

Stampede is a config-driven k6 load testing tool. It separates **profiles** (target configuration) from **patterns** (test shapes).

## Architecture

- `profiles/` — Target configs. Each exports a default config with `baseUrl`, `auth`, `endpoints`. Only `example.js` and `_base.js` are tracked; all others are gitignored.
- `patterns/` — Test patterns (smoke, stress, spike, breakpoint, school-bell, concurrency). Import from `profiles/target.js`.
- `lib/` — Shared: `auth.js` (pluggable auth), `metrics.js` (tracking), `http.js` (helpers), `websocket.js` (Phoenix LiveView).
- `profiles/target.js` — Symlink to active profile. Set via `ln -sf myapp.js profiles/target.js`.

## Setup & Run

```bash
# Create profile
cp profiles/example.js profiles/myapp.js
# Edit with target URL, auth, endpoints
ln -sf myapp.js profiles/target.js

# Run locally
k6 run patterns/smoke.js

# Run via Docker
docker build -t stampede -f Dockerfile .
docker run --rm -e STAMPEDE_PROFILE=myapp -e STAMPEDE_PATTERN=smoke stampede
```

## Key Environment Variables

- `STAMPEDE_MAX_VUS` — Override peak VU count
- `STAMPEDE_DURATION` — Override test duration
- `STAMPEDE_BASE_URL` — Override target URL
- `STAMPEDE_AUTH_STRATEGY` — Auth: `none`, `form_login`, `hmac`, `api_key`, `bearer`
- `EMAIL`, `PASSWORD` — For form_login auth
- `HMAC_SECRET`, `LESSON_ID`, `INST_DOMAIN` — For HMAC auth

## Rules

- Never commit credentials. Profiles except example.js are gitignored.
- Profiles must export `contentPath(template)` as a named export.
- k6 has no dynamic imports. Profile selection is via symlink.
