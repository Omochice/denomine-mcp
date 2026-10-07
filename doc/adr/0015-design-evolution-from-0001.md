# ADR-0015: Design Evolution from ADR-0001

## Status

Accepted — 2026-10-07. Refines [ADR-0001](./0001-tool-surface-aggregation-and-schema.md).

## Context

[ADR-0001](./0001-tool-surface-aggregation-and-schema.md) chose to model each tool's action-dependent arguments as a valibot discriminated union keyed on an `action` field, and to derive the advertised MCP `inputSchema` from that union. `toJsonSchema` emits such a union as a top-level `oneOf`, so the advertised schema was an object whose only declared property was `action` and whose per-action fields lived inside a top-level `oneOf`.

The Anthropic Messages API rejects a tool `input_schema` that has `oneOf`, `anyOf`, or `allOf` at the top level, answering with HTTP 400 (`input_schema does not support oneOf, allOf, or anyOf at the top level`). Claude Code tolerated the advertised schema, but Claude Desktop did not: requests failed with 400, and issue listing ignored every filter and returned all issues, which is what a model sees when the `oneOf` is discarded and only `action` remains. A rejected schema also fails the whole request rather than the one tool, so one tool with this shape makes every tool unusable.

This ADR records how the advertised schema changed to fit that constraint while keeping ADR-0001's decision drivers. Decision 1 (one tool per resource) still holds unchanged, and so does the core of decision 3: argument schemas are still defined once in valibot as a discriminated union on `action`, and that union still validates arguments at runtime. Only the shape in which the union is advertised, and therefore the shape of a call's arguments, changed.

## Design Changes from ADR-0001

### 1. The advertised schema is keyed by action name

**Original Design (ADR-0001)**: the `inputSchema` is the discriminated union as `toJsonSchema` emits it, wrapped as `{ type: "object", properties: { action: { enum } }, oneOf: [...] }`, and a call passes `{ "action": "show", "id": 1 }`.

**Revised Design**: `toObjectSchema` in `src/mcp/tool.ts` re-keys the union by its `action` literal. Each action becomes a property whose value is that branch's object schema without `action`, and the top level allows exactly one such property:

```json
{
  "type": "object",
  "properties": {
    "list": { "type": "object", "properties": { "statusId": { "...": "..." } } },
    "show": { "type": "object", "properties": { "id": { "type": "number" } }, "required": ["id"] }
  },
  "minProperties": 1,
  "maxProperties": 1,
  "additionalProperties": false
}
```

A call passes `{ "show": { "id": 1 } }`. Before validation, `fromActionKeyed` in `src/mcp/tool.ts` turns it back into `{ "action": "show", "id": 1 }` and the server validates that against the unchanged valibot union, so handlers are untouched. An action that the union spreads over several branches, such as the issues tool's `updateNote`, is advertised as an `anyOf` inside its own property, which the API accepts below the top level.

**Rationale**: the original design assumed a client forwards whatever JSON Schema the server advertises, and the Anthropic API breaks that assumption at the top level. Keying by action uses only `properties`, `required`, `minProperties`, `maxProperties`, and `additionalProperties` at the top level, so it passes the API's check, and each action's required fields stay in the schema rather than in prose. Two other shapes were considered. Merging every branch's properties into one flat object with only `action` required was implemented and also avoids the rejection, but it drops each action's required fields from the schema and turns every property whose type differs between actions into a nested `anyOf`; in the issues tool, eight properties collided this way. A chain of top-level `if`/`then`/`else` keeps the call shape but still needs the merged properties, nests one level deeper per action, and has no documented acceptance by the API. Claude Desktop was confirmed to work with the action-keyed schema.

### 2. `--readonly` prunes action properties instead of enum values

**Original Design (ADR-0001)**: in read-only mode the write actions are removed from each tool's `action` enum.

**Revised Design**: the read-only variant of the valibot union still omits the write branches, and because the advertised schema is derived from it, the write actions are absent as properties of the keyed schema. A read-only call naming a write action is rejected by `additionalProperties: false` in the schema and, at runtime, by the valibot union, which has no branch for it.

**Rationale**: decision 2 of ADR-0001 required that a write be inexpressible in read-only mode, not merely rejected. Deriving the keyed schema from the mode-specific union keeps that property with no mode-specific code in the conversion.

## Consequences

### Positive

1. Tools are usable from clients that send the schema to the Anthropic API unchanged, including Claude Desktop, and one tool's schema can no longer fail the whole request.
2. Each action's required fields remain machine-readable in the advertised schema.
3. A property name that means different things in different actions no longer collides, because each action's fields live under their own key.
4. Advertised schema and runtime validation still come from one valibot definition, so ADR-0001's no-drift driver holds.

### Negative

1. The argument shape of every tool changed, which is a breaking change for any caller that built arguments by hand rather than from the advertised schema.
2. The server gains a conversion step between the advertised shape and the validated shape, and argument errors from that step are plain text, like the existing validation errors, rather than the structured failure of [ADR-0002](./0002-handler-response-and-error-mapping.md).
3. The keyed shape is less common than an `action` field, so a model may first send the old shape; the server then answers with the list of valid action keys.

## References

- [ADR-0001](./0001-tool-surface-aggregation-and-schema.md) — the tool surface and schema decision this ADR refines.
- [ADR-0002](./0002-handler-response-and-error-mapping.md) — the structured tool failure that argument errors do not yet use.
- [anthropics/claude-code#45106](https://github.com/anthropics/claude-code/issues/45106) — a report of the same 400 from an MCP tool with top-level composition.
