# ADR-0001: Tool surface — per-resource aggregation, `--readonly` pruning, and valibot schema

## Status

Accepted — 2026-07-12. Consolidates the former ADRs 0001 (endpoint aggregation), 0002 (`--readonly`), and 0009 (valibot schema).

## Context

`deno-redmine` (`@omochice/redmine`) wraps 80+ Redmine REST endpoints. The surface an LLM actually consumes is the tool list plus each tool's input schema, so three questions must be answered together because each shapes that same surface:

- At what granularity are endpoints exposed as MCP tools? One tool per endpoint floods the model with 80+ tools and degrades selection accuracy; a single opaque generic tool minimizes the count but pushes all complexity into a polymorphic argument schema the model fills in poorly.
- How does the requested `--readonly` mode remove mutation capability? Because tools are aggregated, the write operations live inside each tool's `action` enum rather than as separate tools.
- Where does the input schema come from? Each tool needs both an advertised JSON Schema (`inputSchema`) and a runtime validator, and because a tool's argument shape depends on its `action`, the schema is action-polymorphic.

## Decision Drivers

* **Model selection accuracy**: the advertised tool count must stay small enough for reliable tool selection.
* **Full coverage**: the stakeholder wants every endpoint reachable from the start, not a curated subset.
* **`--readonly` must be a real boundary**: in read-only mode a write must be *inexpressible*, not merely rejected after the fact.
* **No schema drift**: the advertised `inputSchema` and the runtime validator must come from one source.

## Considered Options

### Option 1: One MCP tool per endpoint

Each of the 80+ endpoints becomes its own tool.

**Pros:**
- Each tool's argument schema is simple and monomorphic.

**Cons:**
- 80+ tools overload the model's tool list and degrade selection accuracy.

### Option 2: A single generic `redmine_request` tool

One tool takes a resource, an operation, and a free-form parameter bag.

**Pros:**
- Minimal tool count.

**Cons:**
- The opaque, polymorphic argument schema raises the model's input-error rate.

### Option 3: Per-resource aggregation with an `action` parameter (chosen)

Each Redmine resource (issues, projects, wiki, …) becomes one tool whose `action` parameter selects `list` / `show` / `create` / `update` / `delete`.

**Pros:**
- Keeps full coverage while bounding the advertised list to roughly 15-20 tools.

**Cons:**
- Each tool's argument schema is polymorphic on `action`.

For the schema toolchain, valibot with a discriminated union was chosen over zod (larger bundle inflates the compiled binary) and over hand-written JSON Schema plus manual validation (the two drift apart by hand).

## Decision

### 1. Aggregate endpoints per resource

Expose full endpoint coverage, but aggregate into one tool per resource whose `action` parameter selects the operation. The intended tool count is roughly 15-20.

**Rationale**: this is the only option that keeps full coverage and a comprehensible tool list at once; per-endpoint tools sacrifice the list, a single generic tool sacrifices the schema.

### 2. `--readonly` prunes write actions from the schema

When `--readonly` is set, the write actions (`create` / `update` / `delete`) are removed from every tool's `action` enum before the tool definitions are advertised. Schema generation is parameterized by mode and produces a full or a read-only variant.

**Rationale**: enforcing the boundary at the schema level means the model never spends a turn on a write it cannot express, and the advertised list honestly reflects the server's capability in the current mode; runtime rejection would do neither.

### 3. Define argument schemas in valibot and derive JSON Schema

Argument schemas are defined in valibot, modelling the action-dependent shape as a discriminated union keyed on `action`. The MCP `inputSchema` is derived from the valibot schema, and the same valibot schema validates arguments at runtime.

**Rationale**: a single definition producing both artifacts is the only way the advertised schema and the runtime check cannot drift; valibot keeps the compiled binary smaller than the zod equivalent.

## Consequences

### Positive

1. **Comprehensible, complete surface**: the model sees ~15-20 tools yet can reach every endpoint.
2. **Honest read-only mode**: in `--readonly` the advertised tools match the actual capability, and writes are not expressible.
3. **No drift**: the advertised `inputSchema` and the runtime validation share a source and cannot diverge.

### Negative

1. **Polymorphic schemas**: each tool's argument schema is action-dependent, so schema generation and validation must handle per-action shapes.
2. **Conditional handlers**: resources with heterogeneous actions require conditional argument handling inside one handler.
3. **Mode branch**: the tool-definition builder gains a branch driven by the mode flag.
4. **Conversion coverage**: the valibot-to-JSON-Schema conversion must cover the constructs used, in particular discriminated unions.

### Mitigations

- The discriminated union keyed on `action` localizes the per-action shapes to one schema definition per resource, so the polymorphism is declared once rather than scattered through the handler.
- The mode branch is a single parameter to the schema builder, not a duplicated tool set.

## References

- [ADR-0002](./0002-handler-response-and-error-mapping.md) — how the aggregated handlers map results and errors into MCP responses.
- [ADR-0004](./0004-cli-and-instance-selection.md) — where the `--readonly` flag is parsed.
