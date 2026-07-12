# Verification harness

`compose.yaml` brings up a throwaway Redmine 6.0 instance so `denomine-mcp` can be exercised against a real Redmine REST API.
It is a verification aid, not a deployment artifact.

## Start

```sh
docker compose up -d
```

Redmine is served at <http://localhost:3000>.
First sign-in is `admin` / `admin`, which forces a password change.
The image runs migrations on first boot, so wait until the login page loads.

## Enable the REST API and obtain an API key

The REST API is disabled by default, and the MCP server authenticates with an API key.
Both are database settings, so they are applied once against the running container:

```sh
docker compose exec redmine sh -c \
  'SECRET_KEY_BASE="$REDMINE_SECRET_KEY_BASE" bundle exec rails runner \
   "Setting.rest_api_enabled = %q(1); puts User.find_by_login(%q(admin)).api_key"'
```

`docker compose exec` runs outside the entrypoint that exports `SECRET_KEY_BASE`, so the command sets it explicitly; otherwise `rails runner` aborts with a missing-secret error.
The command is safe to re-run.

Register the printed key with the `login` subcommand (see [ADR-0004](./adr/0004-cli-and-instance-selection.md)):

```sh
denomine-mcp login --endpoint http://localhost:3000
```

## Stop

```sh
docker compose down       # keep the data volumes
docker compose down -v    # discard all state
```
