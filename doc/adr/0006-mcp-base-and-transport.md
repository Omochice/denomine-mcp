# ADR-0006: MCP implementation base and transport

## Status

Accepted — 2026-07-12. Carries forward the former ADR 0006. The `deno compile` proof-of-concept passed — `@modelcontextprotocol/sdk` 1.29.0 compiles into a single binary that answers the MCP `initialize` / `tools/list` / `tools/call` handshake over stdio — resolving the contingency in favour of Option 1.

## Context

The server needs an MCP implementation that is compatible with `deno compile`. A survey of JSR found no mature Deno-native MCP framework:

- `@phughesmcr/deno-mcp-template` is a template to clone, not a dependency.
- `@beyondbetter/bb-mcp-server` is a heavier library carrying OAuth and workflow features, with a limited track record.
- `@udibo/deno-mcp` is a purpose-specific server, not a framework.

The official TypeScript SDK (`@modelcontextprotocol/sdk`) documents Deno support via npm: specifiers and tracks the protocol most closely. What remains unverified is whether it compiles cleanly under `deno compile`, which is a hard requirement (see [ADR-0005](./0005-single-binary-distribution-and-release.md)).

## Decision Drivers

* **Protocol currency**: the base should track the MCP spec closely.
* **`deno compile` compatibility**: whatever is chosen must compile into the single binary.
* **Transport fit**: the transport must suit a local single-binary MCP invoked by a client such as Claude Desktop or Claude Code.

## Considered Options

### Option 1: Official `@modelcontextprotocol/sdk` via npm: (intended)

Import the official SDK through Deno's npm: specifiers, using `StdioServerTransport`.

**Pros:**
- Fastest protocol tracking and the most maintained implementation; stdio fits a local single-binary CLI.

**Cons:**
- An npm dependency enters the `deno compile` pipeline, and its compile compatibility is unverified until the PoC completes.

### Option 2: `@beyondbetter/bb-mcp-server` (JSR-native)

A JSR-native MCP library.

**Pros:**
- No npm: specifier; JSR-native.

**Cons:**
- Heavier (OAuth, workflows) with a limited track record.

### Option 3: Vendored `deno-mcp-template`

Clone the template into the repository.

**Pros:**
- Full control, no external dependency.

**Cons:**
- The protocol implementation must be maintained in-tree.

## Decision

### 1. Intend the official SDK over stdio, contingent on a PoC

The intended base is the official `@modelcontextprotocol/sdk` imported via npm:, using `StdioServerTransport`. This decision is contingent on a proof-of-concept that verifies a minimal server compiles cleanly with `deno compile`. If the PoC fails, the fallback is a JSR-native option (`bb-mcp-server`) or a vendored template.

**Rationale**: the official SDK is the most maintained and closest-to-spec option, and stdio is the right transport for a local single-binary MCP; the only open risk is compile compatibility, so the decision is held at `Proposed` until the PoC settles it. HTTP or SSE transport was rejected as overkill for a local single-binary CLI.

## Consequences

### Positive

1. **Most maintained base**: protocol tracking is fastest and the implementation is the most maintained option.
2. **Right transport**: stdio fits a local single-binary MCP invoked by a desktop client.

### Negative

1. **Unverified compile path**: an npm dependency enters the `deno compile` pipeline, and its compatibility is unproven until the PoC completes.

### Mitigations

- `@beyondbetter/bb-mcp-server` is kept as the primary fallback and a vendored `deno-mcp-template` as a secondary fallback, so a failed PoC has a defined next step.
- The ADR stays `Proposed`, signalling that the decision is not yet safe to build upon.

## Implementation Notes

The resolving PoC compiles a minimal `@modelcontextprotocol/sdk` stdio server with `deno compile` and confirms the resulting binary starts and serves. Only a passing PoC moves this ADR to `Accepted`.

## References

- [ADR-0005](./0005-single-binary-distribution-and-release.md) — the `deno compile` single-binary requirement this base must satisfy.
