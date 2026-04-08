# Stampede

A reusable, config-driven [k6](https://k6.io/) load testing tool designed for Railway deployment.

Stampede separates **what to test** (profiles) from **how to test** (patterns), making it easy to run the same load patterns against different targets.

## Quick Start

```bash
# 1. Create a profile from the template
cp profiles/example.js profiles/myapp.js
# Edit profiles/myapp.js with your target URL, auth, and endpoints

# 2. Activate it
ln -sf myapp.js profiles/target.js

# 3. Run a smoke test
k6 run patterns/smoke.js

# 4. Run a spike test with custom VU count
k6 run -e STAMPEDE_MAX_VUS=2000 patterns/spike.js
```

### Docker

```bash
docker build -t stampede -f Dockerfile .
docker run --rm \
  -e STAMPEDE_PROFILE=myapp \
  -e STAMPEDE_PATTERN=smoke \
  -e STAMPEDE_BASE_URL=https://my-app.example.com \
  stampede
```

## Architecture

```
stampede/
  profiles/         Target configurations (URLs, auth, endpoints)
    example.js      Template — copy and customize for your app
    _base.js        Fallback defaults
    target.js       Active profile (symlink, gitignored)
  patterns/         Reusable test patterns (spike, stress, breakpoint, etc.)
  lib/              Shared utilities (auth, metrics, HTTP, WebSocket)
  .claude/          AI agent configuration (Claude Code skill)
  .codex/           AI agent configuration (Codex)
  Dockerfile        Alpine + k6, Railway-compatible
  railway.json      Railway deployment config (one-off worker)
  run.sh            Docker/Railway entrypoint
```

**Profiles** define *what* to test: the target URL, how to authenticate, and which endpoints to hit.

**Patterns** define *how* to test: VU ramp shapes, durations, thresholds, and the test loop.

## Profiles

Profiles are gitignored (they contain credentials). Only `example.js` and `_base.js` are tracked.

### Creating a Profile

1. Copy `profiles/example.js` to `profiles/myapp.js`
2. Configure `baseUrl`, `auth` (pick a strategy), and `endpoints`
3. Export `contentPath(template)` as a named export
4. Activate: `ln -sf myapp.js profiles/target.js`

Or use the agent skill: `bash .claude/skills/stampede/scripts/setup.sh myapp https://my-app.example.com`

## Patterns

| Pattern | Description | Default Max VUs |
|---------|-------------|-----------------|
| `smoke` | Quick sanity check (2 VUs, 30s) | 2 |
| `stress` | Ramping sustained load | 200 |
| `spike` | Escalating spikes with recovery | 1,000 |
| `breakpoint` | Scale until it breaks (HTTP + optional WebSocket) | 500 |
| `school-bell` | Realistic class schedule (jagged spikes) | 10,000 |
| `concurrency` | Flat instant-jump stress (no ramp) | 5,000 |

All patterns import the active profile from `profiles/target.js`.

## Environment Variables

### Core

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STAMPEDE_PROFILE` | Docker/run.sh | - | Profile to activate |
| `STAMPEDE_PATTERN` | Docker/run.sh | - | Pattern to run |
| `STAMPEDE_MAX_VUS` | No | Pattern default | Override peak VU count |
| `STAMPEDE_DURATION` | No | Pattern default | Override duration |
| `STAMPEDE_BASE_URL` | No | Profile default | Override target URL |
| `STAMPEDE_AUTH_STRATEGY` | No | Profile default | Auth strategy override |

### Auth: Form Login

| Variable | Description |
|----------|-------------|
| `EMAIL` | Login email |
| `PASSWORD` | Login password |

### Auth: HMAC

| Variable | Description |
|----------|-------------|
| `HMAC_SECRET` | HMAC secret key |
| `LESSON_ID` | Resource ID for HMAC message |
| `INST_DOMAIN` | Domain for HMAC message |
| `ACCESS_TOKEN` | Pre-computed token (alternative to HMAC_SECRET) |

### Auth: API Key / Bearer

| Variable | Description |
|----------|-------------|
| `API_KEY` | API key for `api_key` strategy |
| `AUTH_TOKEN` | Token for `bearer` strategy |

### k6 Options

| Variable | Description |
|----------|-------------|
| `K6_EXTRA_ARGS` | Additional k6 CLI arguments (e.g., `--out cloud`) |

## Auth Strategies

Stampede supports pluggable authentication, configured in the profile:

- **`none`** — No authentication
- **`form_login`** — POST credentials to a login page with CSRF protection
- **`hmac`** — Compute HMAC-SHA256 token and pass as query parameter
- **`api_key`** — Send a static API key in a request header
- **`bearer`** — Send a bearer token in the Authorization header

## Railway Deployment

Stampede runs as a one-off Railway worker:

1. Set `STAMPEDE_PROFILE` and `STAMPEDE_PATTERN` in Railway dashboard
2. Add auth env vars as needed
3. Deploy — the container runs the test and exits
4. Check logs for results

The `railway.json` configures `restartPolicyType: "NEVER"` so the container exits after the test completes.

## AI Agent Support

Stampede includes configuration for AI coding agents:

- **Claude Code**: `.claude/` directory with project instructions and a skill for running load tests
- **Codex**: `.codex/` directory with equivalent instructions

Open the repo in Claude Code and ask: "Set up Stampede and run a spike test against https://my-app.example.com"

## License

MIT License. See [LICENSE](LICENSE).
