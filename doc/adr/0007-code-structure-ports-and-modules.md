# ADR-0007: Code structure — ports, fakes, and role-based modules

## Status

Accepted — 2026-07-12. Consolidates the former ADRs 0011 (ports and fakes) and 0014 (role-based module structure).

## Context

The two external boundaries are awkward to exercise in CI: the OS keyring over FFI (see [ADR-0003](./0003-credential-storage-in-os-keyring-via-ffi.md)) and the Redmine HTTP API. A headless macOS runner cannot easily use the keychain, and a Linux runner needs a Secret Service provider over D-Bus. The core logic — tool handlers, the schema layer, subcommand dispatch — must stay testable without those services, and the directory layout must place cross-cutting concerns (keyring, CLI) unambiguously while keeping the full-coverage tool set easy to survey.

## Decision Drivers

* **Testable core**: handler, schema, and dispatch logic must be verified without a keychain or a live Redmine.
* **Unambiguous placement**: cross-cutting concerns must have one obvious home.
* **Surveyable tool set**: the aggregated tools (see [ADR-0001](./0001-tool-surface-aggregation-and-schema.md)) must be easy to scan as they grow.

## Considered Options

### Option 1: Integration-first testing against real services

Exercise the real keyring and a live Redmine in CI.

**Pros:**
- Tests the real wiring end to end.

**Cons:**
- The setup is heavy and flaky on headless runners.

### Option 2: Ports with fakes, plus a few smoke tests (chosen)

Define each boundary as a port; back unit tests with fakes; cover the real wiring with a small number of smoke tests.

**Pros:**
- The core is verified in isolation with fast, deterministic fakes.

**Cons:**
- Each boundary carries an interface plus a real and a fake implementation.

For the layout, vertical feature slices per resource were rejected (the placement of cross-cutting keyring and CLI code becomes ambiguous) and a flat `src/` was rejected (the full-coverage tool set makes a flat directory hard to survey early).

## Decision

### 1. Abstract each external boundary as a port, test the core with fakes

The keyring and the Redmine client are each defined as a port (an interface). The core depends only on the ports; fake implementations back the unit tests. The real FFI binding and the real HTTP calls are covered by a small number of smoke tests rather than by the bulk of the suite.

**Rationale**: depending only on ports is what lets handler and schema logic run against fast deterministic fakes on any runner, while the smoke tests still exercise the real wiring the fakes cannot.

### 2. Organize the code by role

TypeScript source lives under `src/` split into `cli`, `keyring`, `redmine`, `tools`, and `mcp`, with a `main.ts` entrypoint; the Rust `cdylib` crate lives under `ffi/`.

- `src/keyring` and `src/redmine` each hold a port, its real backend (FFI binding; HTTP over `deno-redmine`), and a fake for tests.
- `src/tools` holds the per-resource valibot schemas (see [ADR-0001](./0001-tool-surface-aggregation-and-schema.md)) and handlers.
- `src/cli` holds the cliffy subcommand definitions, `src/mcp` holds the server wiring and stdio transport, and `main.ts` composes them.

**Rationale**: a role-based split gives every cross-cutting concern one home and keeps each boundary isolated behind its own directory, matching the ports-and-fakes approach; adding a resource then touches `src/tools` and, where needed, `src/redmine`, without disturbing cross-cutting code.

## Consequences

### Positive

1. **Fast, deterministic core tests**: handler and schema logic is verified in isolation without a keychain or a live Redmine.
2. **Localized change**: adding a resource touches `src/tools` and at most the `src/redmine` client.
3. **Clear boundaries**: each external boundary lives behind its own directory.

### Negative

1. **Indirection**: each boundary carries an interface plus a real and a fake implementation.
2. **Smoke tests still required**: the real FFI wiring and the real HTTP wiring need smoke tests, because fakes do not exercise them.

### Mitigations

- The smoke tests are deliberately few — enough to catch a broken binding — so the bulk of the suite stays on the fast fakes.
- The port interfaces are small (get/set/delete for the keyring; the used subset of `deno-redmine` for the client), keeping the indirection cost low.

## References

- [ADR-0003](./0003-credential-storage-in-os-keyring-via-ffi.md) — the keyring boundary this hides behind a port.
- [ADR-0001](./0001-tool-surface-aggregation-and-schema.md) — the tools and schemas that live in `src/tools`.
- [ADR-0002](./0002-handler-response-and-error-mapping.md) — the handler logic verified with the fakes.
