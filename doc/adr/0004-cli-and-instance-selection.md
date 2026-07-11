# ADR-0004: CLI — instance selection by endpoint URL, credential subcommands, and cliffy

## Status

Accepted — 2026-07-12. Consolidates the former ADRs 0004 (instance by endpoint URL), 0005 (CLI subcommands), and 0013 (cliffy).

## Context

The Redmine instance must be switchable by argument, multiple instances must hold distinct API keys in the keyring (see [ADR-0003](./0003-credential-storage-in-os-keyring-via-ffi.md)), and the MCP server only *reads* the key — so a separate path must write it. These concerns form one CLI design:

- `deno-redmine`'s `Context` is `{ endpoint, apiKey }`, so the endpoint is the natural unit of instance identity, and the keyring needs a stable per-instance account key.
- Credential entry must not leak the key into shell history or process arguments.
- The CLI has subcommands and a hidden credential prompt, and the implementation library trades developer ergonomics against the size it adds to the compiled binary.

## Decision Drivers

* **Instance switchability with no extra state**: selecting an instance should not require a registry to keep in sync.
* **No key leakage**: the key must never appear in shell history or `ps` output.
* **Automation-friendly**: non-interactive credential entry must still work in scripts.
* **Minimal hand-rolled CLI plumbing**: subcommand dispatch and a hidden prompt should not be written by hand.

## Considered Options

### Option 1: Named profiles (`--profile work`)

A registry maps profile names to endpoints.

**Pros:**
- Short, memorable instance selectors.

**Cons:**
- Adds a mapping table to store and keep in sync.

### Option 2: Endpoint URL as identity, key namespaced by URL (chosen)

`--endpoint <url>` selects the instance; the keyring entry uses a fixed service name and sets the account to the endpoint URL.

**Pros:**
- No profile-to-endpoint mapping state; each instance maps to a distinct keyring account.

**Cons:**
- The full URL must be supplied on every invocation, and must be canonicalized.

For credential entry, an `--api-key` flag was rejected (plaintext leaks via shell history and `ps`), as was a stdin-only login with no prompt (unfriendly interactively) and a subcommand-less default `serve` (ambiguous against `login`). For the CLI library, `@std/cli` `parseArgs` was rejected because it is only a parser, leaving subcommand dispatch and the hidden prompt to be hand-written.

## Decision

### 1. Select the instance by endpoint URL

The endpoint URL is passed as `--endpoint <url>`. The keyring entry uses a fixed service name (the application id) and sets the account to the endpoint URL, so each instance's key is namespaced by its own URL. There is no separate profile registry.

**Rationale**: making the URL the single source of instance identity removes any mapping table to maintain, and namespacing the keyring account by URL is what lets multiple instances coexist.

### 2. Provide `serve` / `login` / `logout` / `list` subcommands

- `serve --endpoint <url> [--readonly]`: runs the stdio MCP server.
- `login --endpoint <url>`: stores the key for that endpoint in the keyring.
- `logout --endpoint <url>`: deletes the stored key for that endpoint.
- `list`: shows the endpoints that currently have a stored key.

`login` reads the key from a hidden (no-echo) TTY prompt, falling back to reading stdin when the input is not a TTY.

**Rationale**: separating credential management from serving keeps the key off the argument list entirely, and the stdin fallback lets `echo "$KEY" | denomine-mcp login --endpoint <url>` work in automation while the interactive path stays hidden.

### 3. Build the CLI with cliffy

cliffy's `Command` defines the subcommands declaratively, and its `Secret` prompt provides the hidden credential input.

**Rationale**: cliffy supplies both the subcommand structure and the hidden prompt out of the box, avoiding a hand-rolled raw-TTY implementation; it is a comparatively large dependency but it compiles into the single binary.

## Consequences

### Positive

1. **No mapping state**: the URL is the only instance identity, and instances coexist because each maps to a distinct keyring account.
2. **No key leakage**: the key is never an argument, so it never appears in shell history or `ps` output.
3. **Both interactive and scripted login**: the hidden prompt and the stdin fallback cover both.
4. **Declarative CLI**: subcommands and the hidden prompt come from cliffy rather than hand-written code.

### Negative

1. **URL on every call**: the full endpoint URL must be supplied on every `login` and `serve`, a minor UX cost.
2. **Canonicalization needed**: the URL must be canonicalized (scheme, trailing slash) so one logical instance maps to exactly one keyring account.
3. **Client config coupling**: the MCP client configuration must invoke `serve --endpoint <url>`.
4. **Dependency size**: cliffy is a comparatively large dependency baked into the binary.

### Mitigations

- URL canonicalization is applied at a single point before the keyring account is derived, so the same logical instance always resolves to one account.
- cliffy's size is accepted because it compiles into the single binary rather than becoming a runtime dependency, and it removes the platform-sensitive raw-TTY code that a hand-rolled prompt would require.

## References

- [ADR-0003](./0003-credential-storage-in-os-keyring-via-ffi.md) — the keyring this CLI writes to and reads from.
- [ADR-0001](./0001-tool-surface-aggregation-and-schema.md) — the `--readonly` flag `serve` accepts.
