# Stampede Load Test Skill

Run config-driven k6 load tests against any web application.

## Commands

### Setup

Create a profile for a target application and build the Docker image.

```bash
# Create profile from template
bash .claude/skills/stampede/scripts/setup.sh <profile-name> <base-url> [auth-strategy]

# Build Docker image
bash .claude/skills/stampede/scripts/setup.sh --docker
```

**Arguments:**
- `profile-name` — Name for the profile (e.g., `myapp`)
- `base-url` — Target application URL (e.g., `https://my-app.example.com`)
- `auth-strategy` — Optional: `form_login`, `hmac`, `api_key`, `bearer`, `none` (default: `none`)

### Run

Execute a load test pattern against the active profile.

```bash
bash .claude/skills/stampede/scripts/run.sh <pattern> [options]
```

**Arguments:**
- `pattern` — One of: `smoke`, `stress`, `spike`, `breakpoint`, `school-bell`, `concurrency`

**Options:**
- `--profile <name>` — Profile to use (default: last activated)
- `--max-vus <n>` — Override max VUs
- `--duration <time>` — Override duration (e.g., `5m`, `30s`)
- `--base-url <url>` — Override target URL
- `--auth <strategy>` — Override auth strategy
- `--docker` — Run in Docker instead of locally

### Status

Check available profiles, patterns, and recent test results.

```bash
bash .claude/skills/stampede/scripts/status.sh
```

### Teardown

Clean up Docker images and Railway deployments.

```bash
bash .claude/skills/stampede/scripts/teardown.sh [--docker] [--railway]
```

## Workflow

1. **Setup**: Create a profile for your target → `setup.sh myapp https://my-app.com`
2. **Smoke test**: Verify connectivity → `run.sh smoke --profile myapp`
3. **Load test**: Run the desired pattern → `run.sh spike --profile myapp --max-vus 1000`
4. **Review**: Check k6 output for response times, error rates, and thresholds

## Available Patterns

| Pattern | Description | Default Max VUs | Typical Duration |
|---------|-------------|-----------------|------------------|
| `smoke` | Quick sanity check | 2 | 30s |
| `stress` | Ramping sustained load | 200 | ~11m |
| `spike` | Escalating spikes with recovery | 1,000 | ~6m |
| `breakpoint` | Scale until it breaks | 500 | ~11m |
| `school-bell` | Realistic jagged spikes | 10,000 | ~4m |
| `concurrency` | Flat instant-jump stress | 5,000 | 2m |

## Auth Strategies

| Strategy | Required Env Vars | Description |
|----------|-------------------|-------------|
| `none` | — | No authentication |
| `form_login` | `EMAIL`, `PASSWORD` | POST to login form with CSRF |
| `hmac` | `HMAC_SECRET`, `LESSON_ID`, `INST_DOMAIN` | HMAC-SHA256 token auth |
| `api_key` | `API_KEY` | Static API key in header |
| `bearer` | `AUTH_TOKEN` | Bearer token in Authorization header |
