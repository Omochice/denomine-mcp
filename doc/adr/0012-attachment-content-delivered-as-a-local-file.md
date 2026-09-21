# ADR-0012: Deliver attachment content as a local file

## Status

Accepted — 2026-09-21. Departs from decision 2 of [ADR-0002](./0002-handler-response-and-error-mapping.md) for binary content.

## Context

`@omochice/redmine` 3.4.0 added `attachment.download(id)`, which returns the metadata of an attachment together with its content as a `ReadableStream<Uint8Array>`. An issue often carries its evidence — a screenshot, a log, a spreadsheet — as an attachment, and until now the model could see that an attachment existed (`include: ["attachments"]` on an issue) but could not reach what was in it.

Every tool so far answers with text: `ToolResponse` holds only `{ type: "text" }` content, and ADR-0002 decision 2 places the library's response JSON into `content` unchanged. An attachment does not fit that shape, because its content is arbitrary bytes of a size the server does not control. Redmine's attachment size limit is an instance setting, so a multi-gigabyte file is possible.

The server is also a compiled binary that talks to its client over stdio (see [ADR-0006](./0006-mcp-base-and-transport.md)), so whatever a tool returns is serialized into a single JSON-RPC message.

## Decision Drivers

* **Bounded context usage**: ADR-0002 already requires that the model can regulate how much data enters its context; attachment bytes must not bypass that.
* **Bounded memory**: the library streams so that a file of any size is never held in memory, and the tool should not throw that property away.
* **One behaviour per action**: ADR-0001 aggregates actions per resource, and each action should stay simple enough for the model to fill in correctly.
* **Testable core**: handlers must stay verifiable with fakes, without the permissions a real boundary needs (ADR-0007).

## Considered Options

### Option 1: Return the content inline as MCP content

Widen `ToolResponse` so an image comes back as `{ type: "image", data, mimeType }` and any other type as an embedded resource with a base64 `blob`.

**Pros:**
- A multimodal client sees a screenshot directly, with no further step.
- Nothing is written to the user's machine.

**Cons:**
- The whole file must be buffered and base64-encoded, which discards the streaming the library provides.
- The encoded bytes land in the model's context, and the model cannot bound them the way `limit`/`offset` bound a list.
- A large attachment becomes one very large JSON-RPC message on stdio.

### Option 2: Save the content to a caller-supplied path (chosen)

`download` takes `path`, streams the content to that file, and answers with `{ path, filename, contentType, filesize }` as JSON text.

**Pros:**
- The content streams to disk, so neither the server's memory nor the model's context holds it.
- The response stays plain JSON text, the same kind of payload every other tool returns.
- The client can then read the file with whatever tool suits its type.

**Cons:**
- The MCP server now writes to the local filesystem, which it never did before.
- The model needs a second step to look at the content.

### Option 3: Both, selected by whether `path` is given

**Pros:**
- Covers the convenience of option 1 and the safety of option 2.

**Cons:**
- One action carries two behaviours and two response shapes, which is the polymorphism ADR-0001 tries to keep small.
- It inherits every cost of option 1 whenever `path` is omitted.

## Decision

We add a `redmine_attachments` tool with two actions, `show` and `download`, and deliver content by option 2.

### 1. `download` writes to a caller-supplied path and returns the path

**Change from**: no way to reach attachment content.

**Change to**:

```json
{ "action": "download", "id": 42, "path": "/tmp/evidence.png", "maxSize": 10485760 }
```

```json
{ "path": "/private/tmp/evidence.png", "filename": "evidence.png", "contentType": "image/png", "filesize": 48211 }
```

The returned `path` is the absolute path actually written.

**Rationale**: only this option keeps both bounded-context and bounded-memory drivers intact, and it keeps the response a plain JSON text payload, so `ToolResponse` does not have to grow content variants for a single tool. `show` is part of the same tool so the model can read `filesize` and `contentType` before it decides to download.

### 2. An existing file is never overwritten

The file is opened with `createNew: true`, so a `path` that already exists fails the call.

**Rationale**: the path is chosen by a model, and silently replacing a file on the user's machine is the one outcome of this tool that cannot be undone. Refusing costs the model one retry with another name. An `overwrite` flag was not added because nothing has asked for it yet.

### 3. `maxSize` bounds the download, defaulting to 500 MiB, and is enforced twice

`maxSize` is an optional positive integer in bytes with a default of `500 * 1024 * 1024`. The handler first compares it with the `filesize` Redmine declares and, when the attachment is larger, cancels the body without opening a file. The file port then counts the bytes as they stream and, once the count passes the limit, aborts and removes the partial file.

**Rationale**: the limit exists because a huge file may be attached, and the declared `filesize` is only metadata, so the streamed count is what actually protects the disk; the early check merely avoids creating a file that is known to be too large. The default has no measured basis. It was chosen as a guard that ordinary attachments never reach while a multi-gigabyte one is stopped; a required argument was rejected because it makes every call carry a number the model has to invent.

### 4. Both actions stay available under `--readonly`

The attachment schema ignores the mode and always advertises `show` and `download`.

**Rationale**: ADR-0001 introduced `--readonly` so that a mutation of Redmine is inexpressible. A download only reads Redmine; what it writes is a file on the machine of the user who started the server. Pruning it would remove a read capability from the mode meant for reading.

### 5. The local filesystem sits behind its own port in `src/file/`

`src/file/port.ts` defines `FilePort.save(path, body, maxSize)`, `src/file/local.ts` binds it to Deno, and `src/file/fake.ts` backs the unit tests. The port fails with a plain `Error`; the handler turns it into the tool-layer failure payload.

**Rationale**: the filesystem is a new external boundary, and the unit tests run with `--allow-read` only, so by ADR-0007 it needs a port and a fake rather than direct `Deno.open` calls in the handler. It lives outside `src/redmine` because it has nothing to do with Redmine, and it reports a plain `Error` so that a boundary module does not depend on the tool layer's payload type.

### 6. A filesystem failure uses the same failure payload as a Redmine failure

**Change from**: `toToolResponse(result: RedmineResult<unknown>)`.

**Change to**: `toToolResponse(result: Result.Result<unknown, ToolFailure>)`, where `ToolFailure = { status: number; errors: string[] }`.

A failure that has no HTTP status — an existing file, an exceeded `maxSize` — reports `status: 0`, the convention `toRedmineError` already uses for non-response errors.

**Rationale**: ADR-0002 decision 3 fixed one failure shape so the model can read `errors` and retry. Naming that shape in the tool layer lets a second boundary reuse the single mapping instead of copying it. `RedmineError` is structurally the same type, so no existing caller changed.

## Consequences

### Positive

1. **Attachment content is reachable**: the model can fetch the evidence an issue refers to.
2. **Size-independent cost**: neither memory nor context grows with the attachment.
3. **Uniform responses**: the tool answers with JSON text and the shared failure payload, like every other tool.

### Negative

1. **The server writes local files**: a model-chosen path is a new way for the server to affect the user's machine.
2. **Two steps to see content**: the client has to read the saved file itself, and a client without file access gains nothing from the tool.
3. **An arbitrary default**: 500 MiB is a guess, and it may be too high for a small disk or too low for an instance that stores large archives.
4. **Relative paths are ambiguous**: a relative `path` resolves against the working directory of the server process, which the model does not know.
5. **More indirection**: a second port with a real and a fake implementation exists for one operation.

### Mitigations

- Overwriting is impossible, the write is bounded by `maxSize`, and a failed or oversized write leaves no partial file behind.
- `show` exposes `filesize` and `contentType` first, so the model can decide whether a download is worth the second step.
- `maxSize` can be lowered per call, and the default lives in one named constant (`defaultMaxSize`) should it need to change.
- The tool description recommends an absolute path, and the response reports the absolute path that was written.
- `FilePort` has a single method, keeping the cost of the extra port small.

## Implementation Notes

- `update` and `delete` exist on the library's attachment client but are not exposed; they would be write actions pruned by `--readonly` if added.
- The real `LocalFile` cannot run under the unit tests' permissions; it was checked manually for the happy path, an existing file, a stream that errors midway, an over-limit stream, and an unopenable path.
- `src/redmine/attachment_integration.test.ts` seeds an attachment with raw `POST /uploads.json` and `PUT /issues/:id.json` requests, because no port here creates one. It passes against the Redmine 7.0 of `compose.yaml`.

## References

- [ADR-0001](./0001-tool-surface-aggregation-and-schema.md) — per-resource aggregation and what `--readonly` prunes.
- [ADR-0002](./0002-handler-response-and-error-mapping.md) — the raw-JSON response this tool departs from, and the failure payload it reuses.
- [ADR-0007](./0007-code-structure-ports-and-modules.md) — ports and fakes, applied here to the filesystem.
- [ADR-0008](./0008-design-evolution-from-0002.md) — the Result boundary in the adapter that `AttachmentClient` follows.
