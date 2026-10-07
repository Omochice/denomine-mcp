# ADR-0016: Design Evolution from ADR-0001

## Status

Accepted — 2026-10-08. Refines [ADR-0001](./0001-tool-surface-aggregation-and-schema.md).

## Context

[ADR-0001](./0001-tool-surface-aggregation-and-schema.md) decided that every tool aggregates the endpoints of one Redmine resource, so the tool list is a map of Redmine and nothing else.

Debugging a misbehaving call needs to know which build of denomine-mcp answered it, and the model is the party that sees the misbehaviour first. The release version reaches the client only as the MCP `serverInfo` of the initialize handshake, which clients rarely show to the model, and nothing recorded the commit a binary was built from, so a local build could not be told apart from a release of the same version.

This ADR records the one tool that reports on the server instead of on Redmine, kept visible here because it departs from decision 1 of ADR-0001. Decisions 2 and 3, and the action-keyed schema of [ADR-0015](./0015-design-evolution-from-0001.md), apply to it unchanged.

## Design Changes from ADR-0001

### 1. One tool reports on the server itself

**Original Design (ADR-0001)**: every tool is one Redmine resource with its endpoints selected by an `action`, so each tool name starts with `redmine_` and maps to a part of the Redmine REST API.

**Revised Design**: `denomine_mcp_info` in `src/tools/server-info/` reports the release version and the commit the binary was built from. It has the single action `show` with no fields, is advertised in both modes because it reads nothing from Redmine, and answers:

```json
{ "version": "0.6.0", "build": { "commit": "0eb3a0cf…", "dirty": false } }
```

`build` is `null` when the server runs from source. The compile task writes the commit and whether the tree was dirty to `build-info.json`, embeds it with `--include` in the same way [ADR-0013](./0013-third-party-licenses-embedded-in-the-binary.md) embeds the license notices, and removes the file afterwards so a later run from source does not read a stale commit.

**Rationale**: the tool list is the only channel a model can query on its own, so the version has to be a tool for the model to report it; appending the commit to `serverInfo` or to `--version` would inform the user but not the model. The name carries the server's name rather than `redmine_` so that it is not mistaken for `redmine_versions`, which lists Redmine's project versions, and its description says so explicitly. One extra tool with an empty argument object costs little against the selection-accuracy driver of ADR-0001, while a field added to every Redmine tool's responses would have changed the response shape fixed by [ADR-0002](./0002-handler-response-and-error-mapping.md).

## Consequences

### Positive

1. A model can state the exact version and commit of the server it is using when it reports a bug, without the user looking it up.
2. A locally built binary, including one built from uncommitted changes, can be told apart from a release of the same version.

### Negative

1. The tool list is no longer purely a map of Redmine resources, so a reader of the list has to tell this tool apart by its name.
2. A binary built outside a git checkout reports `build: null`, the same as a run from source.

## References

- [ADR-0001](./0001-tool-surface-aggregation-and-schema.md) — the per-resource tool surface this ADR refines.
- [ADR-0013](./0013-third-party-licenses-embedded-in-the-binary.md) — the compile-time embedding the build info reuses.
- [ADR-0015](./0015-design-evolution-from-0001.md) — the action-keyed schema the tool is advertised with.
