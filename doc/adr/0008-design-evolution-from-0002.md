# ADR-0008: Design Evolution from ADR-0002

## Status

Accepted — 2026-07-20. Refines [ADR-0002](./0002-handler-response-and-error-mapping.md).

## Context

[ADR-0002](./0002-handler-response-and-error-mapping.md) chose to consume `deno-redmine`'s Result-returning `result/*` exports and branch the returned Result explicitly at each handler call site, in preference to wrapping the exception-throwing `throwable/*` exports in a shared `try`/`catch`. That choice rested on the library offering both variants.

Upgrading the dependency to `@omochice/redmine` v3 removed that premise: v3 drops the `result/*` versus `throwable/*` split and is throw-only, so a Result-returning variant no longer exists to consume. v3 also turns the list endpoints into async generators that paginate, returns bare objects from `show`, returns `void` from `create`/`update`/`delete`, changes `wiki.show` to take a params object, and reports a failed request by throwing a `RedmineResponseError` (carrying the status and the already-drained response body) rather than a Result whose error holds the originating `Response`.

This ADR records how the design in ADR-0002 evolved to keep its decision drivers — an explicit error boundary that swallows nothing, and status-and-`errors` disclosure — intact against the new library shape. Decisions 2 (return the raw response JSON, paging as tool arguments) and 3 (disclose HTTP status and Redmine `errors`, exclude headers and auth) of ADR-0002 still hold unchanged; only the mechanism that produces the Result and extracts the error changed.

## Design Changes from ADR-0002

### 1. The Result boundary moves from the handler to the adapter, backed by byethrow

**Original Design (ADR-0002)**: handlers call the library's `result/*` exports and branch the returned Result at each call site; no `try`/`catch` scaffolding exists because the library already returns a Result.

**Revised Design**: v3 throws, so each adapter method in `src/redmine/*_client.ts` wraps its library call in `@praha/byethrow`'s `Result.try({ try, catch: toRedmineError })`, which turns a throw into a failure Result. The explicit boundary is preserved but relocated: the port layer is the seam that always hands a Result to the tool layer, typed as `RedmineResult<T> = Result.Result<T, RedmineError>` in `src/redmine/port.ts`. Handlers branch that port Result exactly as before, so the tool layer is unchanged.

**Rationale**: ADR-0002 rejected wrapping the throwable variant only because it invited a shared, easy-to-leave-incomplete `try`/`catch`. `Result.try` at every adapter method is neither shared nor implicit: each call has its own conversion, and the port's Result type keeps the branch explicit and total at the seam the handlers already depend on. The original driver — nothing is silently swallowed and the boundary is visible — is met without a Result-returning library variant, which v3 no longer provides.

### 2. List results are drained from an async generator

**Original Design (ADR-0002)**: a list call returns a Result whose value is the array of items, placed into `content` unchanged.

**Revised Design**: v3's list endpoints are async generators that paginate. The adapter drains one with `Array.fromAsync` inside the `Result.try` body, yielding the same bare array as before, which the handler passes through unchanged.

**Rationale**: draining in the adapter keeps the pagination detail inside the library boundary and preserves the exact value shape ADR-0002's pass-through decision (2) relies on, so nothing downstream — including the model-facing payload — changes.

### 3. The error is extracted from a thrown `RedmineResponseError`

**Original Design (ADR-0002)**: the shared mapping reads the HTTP status and the Redmine `errors` array from the `Response` that the library's failure Result carries as its error.

**Revised Design**: v3 throws `RedmineResponseError` (exported from `@omochice/redmine/error`), which carries the status and the response body already drained to a string. `toRedmineError` in `src/redmine/error.ts` maps that to the port's `{ status, errors }`, parsing the `errors` array out of the body string and falling back to status `0` with the message for any non-response error.

**Rationale**: this keeps decision 3 of ADR-0002 — disclose status and `errors`, exclude headers and auth — behaving identically, while adapting to v3 draining the body itself. The mapping stays a single function reused by every adapter, so the error-shape coupling ADR-0002 localized remains in one place.

## Consequences

### Positive

1. The port's `RedmineResult` gives the whole codebase one Result representation with reusable combinators, and the explicit, non-swallowing boundary survives the loss of the library's Result variant.
2. The tool layer, its response mapping, and the model-facing payloads and error shapes are unchanged, so the evolution is invisible above the port.

### Negative

1. Every adapter method now carries its own `Result.try`, which is more scaffolding per method than passing a library Result straight through.
2. The codebase gains a dependency on `@praha/byethrow` and couples to v3's `RedmineResponseError` shape.

## References

- [ADR-0002](./0002-handler-response-and-error-mapping.md) — the handler response and error mapping this ADR refines.
- [ADR-0007](./0007-code-structure-ports-and-modules.md) — the ports and adapters where the Result boundary now lives.
