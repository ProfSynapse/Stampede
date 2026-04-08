# Stampede

Config-driven k6 load testing tool. Separates **profiles** (what to test) from **patterns** (how to test).

## Quick Start

```bash
# 1. Create a profile from the example template
cp profiles/example.js profiles/myapp.js
# Edit profiles/myapp.js with your target URL, auth, and endpoints

# 2. Activate it as the target
ln -sf myapp.js profiles/target.js

# 3. Run a pattern
k6 run patterns/smoke.js
```

## Structure

```
stampede/
  profiles/         Target configs (URL, auth, endpoints)
    example.js      Template — copy and customize
    _base.js        Fallback defaults
    target.js       Active profile (symlink, gitignored)
  patterns/         Test shapes (spike, stress, breakpoint, etc.)
  lib/              Shared utilities (auth, metrics, HTTP, WebSocket)
  run.sh            Docker/Railway entrypoint
  Dockerfile        Alpine + k6 image
  railway.json      Railway one-off worker config
```

## Key Conventions

- **profiles/target.js** is what patterns import. Set it via `ln -sf myapp.js profiles/target.js` or via `run.sh` (which does this automatically from `STAMPEDE_PROFILE`).
- **Profiles are gitignored** except `example.js` and `_base.js`. Never commit credentials.
- **Auth strategies**: `form_login`, `hmac`, `api_key`, `bearer`, `none` — configured in the profile.
- **All tunables via env vars**: `STAMPEDE_MAX_VUS`, `STAMPEDE_DURATION`, `STAMPEDE_BASE_URL`, `STAMPEDE_AUTH_STRATEGY`.
- Profiles must export `contentPath(template)` as a named export (used by content-heavy patterns).

## Available Patterns

| Pattern | What It Does |
|---------|-------------|
| `smoke` | 2 VUs, 30s sanity check |
| `stress` | Ramping sustained load (configurable max) |
| `spike` | Escalating spikes with recovery |
| `breakpoint` | Scale until it breaks (HTTP + optional WebSocket) |
| `school-bell` | Jagged spikes simulating class schedules |
| `concurrency` | Flat instant-jump stress (no ramp) |

## Running via Docker

```bash
docker build -t stampede -f Dockerfile .
docker run --rm \
  -e STAMPEDE_PROFILE=myapp \
  -e STAMPEDE_PATTERN=smoke \
  -e STAMPEDE_BASE_URL=https://my-app.example.com \
  stampede
```

## Agent Skills

The `.claude/skills/stampede/` skill enables AI agents to operate Stampede. Ask:
- "Set up Stampede for https://my-app.com"
- "Run a spike test with 2000 VUs"
- "Show me the available patterns"
