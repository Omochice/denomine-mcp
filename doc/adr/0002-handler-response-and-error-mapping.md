# ADR-0002: Handler response and error mapping

## Status

Accepted — 2026-07-12. Consolidates the former ADRs 0007 (Result-based API), 0015 (error disclosure), and 0016 (raw JSON and paging).

## Context

Every tool handler turns a `deno-redmine` call into an MCP tool response, so the handler needs one coherent answer to how both outcomes are mapped:

- `deno-redmine` exports a Result-returning variant (`result/*`) and an exception-throwing variant (`throwable/*`) of every operation. The chosen variant's failure model shapes every call site.
- On success, list operations can return large payloads, and how that payload is placed into the MCP `content` directly governs how much of the model's context is consumed.
- On failure, the amount of Redmine error detail surfaced to the model trades recoverability (enough for the model to fix its arguments) against leaking sensitive material such as authentication headers.

## Decision Drivers

* **Explicit error boundary**: no failure should be silently swallowed, and the mapping should be visible at each call site.
* **Bounded context usage**: the model must be able to regulate how much list data enters its context.
* **Actionable but safe errors**: failures must tell the model enough to recover without exposing secrets.

## Considered Options

### Option 1: Throwable variant wrapped in a shared `try`/`catch`

Handlers call the exception-throwing exports and a shared wrapper converts thrown errors.

**Pros:**
- Less branching in the happy path.

**Cons:**
- Easy to miss distinctions between error types; the error handling is implicit and easy to leave incomplete.

### Option 2: Result-based variant, branched per call (chosen)

Handlers call the `result/*` exports and branch the returned Result explicitly.

**Pros:**
- The error boundary is explicit at every call site; nothing is swallowed and no `try`/`catch` scaffolding is needed.

**Cons:**
- Each handler destructures and branches the Result, slightly more verbose per call site.

For response shaping, returning the raw JSON with paging exposed as arguments was chosen over per-resource field trimming (the trimming policy must be designed per resource, and detail is already reachable via `show`) and over a `verbosity` argument (adds per-resource shaping logic to maintain).

## Decision

### 1. Use the Result-based `deno-redmine` exports

Handlers use the `result/*` exports. Each handler branches on the returned Result: a success maps to MCP `content`, a failure maps to an `isError` response.

**Rationale**: the explicit branch makes the error boundary visible at every call site and prevents the silent swallowing that a shared `try`/`catch` around the throwable variant invites.

### 2. Return the raw response JSON, paging as tool arguments

The handler places the `deno-redmine` response JSON into `content` unchanged and exposes the paging controls (`limit` / `offset`) as tool arguments, so the model regulates the volume itself. No server-side field trimming or summarization is applied.

**Rationale**: passing the payload through keeps the implementation simple and drops no information, while `limit`/`offset` give the model direct control over its own context budget; server-side summarization stays available as a later optimization.

### 3. Disclose HTTP status and Redmine `errors`, exclude headers and auth

A failure is returned as a structured tool error containing the HTTP status and the `errors` array Redmine returns (its validation messages). Request and response headers and any authentication material are excluded.

**Rationale**: the validation messages are what let the model correct an invalid field and retry, and deliberately dropping headers and auth data bounds the leak surface; a generic "request failed" would make the model repeat the same failure, and the raw error response risks leaking secrets.

## Consequences

### Positive

1. **Visible error handling**: every failure is branched at its call site, so none is silently dropped.
2. **Model-controlled context**: `limit`/`offset` let the model bound how much list data it ingests, and no information is trimmed away.
3. **Recoverable, safe failures**: the model receives actionable validation detail while headers and auth never reach it.

### Negative

1. **Per-call verbosity**: each handler must destructure and branch the Result explicitly.
2. **Large payloads possible**: without trimming, a wide `limit` can still return a large payload.
3. **Error-shape coupling**: the mapping must extract status and `errors` from the Redmine error shape and drop everything else.

### Mitigations

- Server-side summarization remains available as a later optimization if payload size becomes a problem; the pass-through decision does not foreclose it.
- The status-and-`errors` extraction is a single mapping function shared by all handlers, so the error-shape coupling lives in one place.

## References

- [ADR-0001](./0001-tool-surface-aggregation-and-schema.md) — the per-resource tools whose handlers this mapping governs.
