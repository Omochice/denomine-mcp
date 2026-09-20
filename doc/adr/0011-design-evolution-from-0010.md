# ADR-0011: Design Evolution from ADR-0010

## Status

Accepted — 2026-09-21. Refines [ADR-0010](./0010-design-evolution-from-0005.md).

## Context

[ADR-0010](./0010-design-evolution-from-0005.md) moved the release from a hand-pushed tag to release-please. It recorded that the release pull request rewrites one version literal: the one the CLI passes to `.version()` in `src/cli/mod.ts`.

That literal was not the only place the project states its version. The MCP server answers `initialize` with a `serverInfo.version`. It was hardcoded to `0.0.0` and never listed for release-please, so a client saw a version unrelated to the binary it had launched. The `keyring_ffi` crate embedded in the binary also had its own version, which stayed at `0.1.0` while the binary reached `0.3.0`.

This ADR records how the set of files release-please rewrites evolved once those were noticed. The decision that release-please cuts the release holds unchanged, as does the rest of ADR-0010. This ADR exists to keep that evolution visible rather than editing ADR-0010 in place.

## Design Changes from ADR-0010

### 1. The version literal lives in its own module and has two readers

**Original Design (ADR-0010)**: release-please rewrites the version literal in `src/cli/mod.ts`, where it is an argument to the CLI's `.version()` call.

**Revised Design**: the literal is the exported constant in `src/version.ts`, the only TypeScript file listed in `extra-files`. The CLI and the MCP server info both import it.

```ts
export const VERSION = "0.3.0"; // x-release-please-version
```

**Rationale**: annotating a second literal in `src/mcp/server.ts` would have fixed `serverInfo`, but it repeats the mistake that caused the bug. Every new reader of the version becomes another entry to remember in `extra-files`, and forgetting one fails without any signal. With one annotated literal, a new reader imports the constant and the release configuration does not change.

### 2. The release pull request also versions the `keyring_ffi` crate

**Original Design (ADR-0010)**: the release pull request changes the changelog, the manifest, and one version literal. The crate's version is not managed.

**Revised Design**: `extra-files` also lists `ffi/Cargo.toml` and `ffi/Cargo.lock` through the TOML updater, so the crate's version follows the binary's.

```json
{ "type": "toml", "path": "ffi/Cargo.toml", "jsonpath": "$.package.version" },
{ "type": "toml", "path": "ffi/Cargo.lock", "jsonpath": "$.package[?(@.name.value=='keyring_ffi')].version" }
```

**Rationale**: the crate is not published and only ships inside the binary, so a version of its own carries no information. A version equal to the release says which release a given `cdylib` came from.

The lockfile is not optional. The release build runs `cargo build --locked`, and cargo refuses to build when the manifest is bumped without the crate's own lock entry. ADR-0010 builds in the same run that cuts the release, so the failure would arrive after the release pull request is merged and the draft release created. `main` would then claim a version that was never published.

The annotation comment used in `src/version.ts` is not available for the lockfile, because cargo regenerates the file and would drop the comment. Both Cargo files go through a JSONPath instead.

The filter reads `@.name.value` rather than `@.name`. release-please's TOML parser wraps every scalar in an object that records its byte offsets, so a filter on `@.name` matches nothing. The updater then only logs a warning and leaves the file as it was. The mistake would first show as a failed release build.

## Consequences

### Positive

1. The CLI, the MCP `serverInfo`, and the embedded crate report the same version, and all three follow the release without a manual step.
2. Adding another reader of the version is an import, not a change to the release configuration.

### Negative

1. The release pull request now rewrites three files besides the changelog and the manifest. ADR-0010 justified the checks that pull request does not run by how little it changes. A lockfile edit is a larger thing to leave unchecked than a string literal.
2. The lockfile JSONPath depends on how release-please's TOML parser represents values. That is an implementation detail rather than a documented contract, and a release-please upgrade could change it.

### Mitigations

- Both TOML updates were exercised against the real files with release-please's own updater before being adopted. Each changed exactly one line, and the comments in `ffi/Cargo.toml` survived. `cargo metadata --locked` accepted the rewritten pair and rejected a manifest bumped alone.
- The build matrix runs on the push to `main` that merges the release pull request. A lockfile left behind surfaces there as a red release run rather than passing unnoticed.

## References

- [ADR-0010](./0010-design-evolution-from-0005.md) — the release-please decision this ADR refines.
- [ADR-0005](./0005-single-binary-distribution-and-release.md) — the distribution and release decision ADR-0010 itself refines.
- [ADR-0003](./0003-credential-storage-in-os-keyring-via-ffi.md) — the `keyring_ffi` crate whose version is now managed.
