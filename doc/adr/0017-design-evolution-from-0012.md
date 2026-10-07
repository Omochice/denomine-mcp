# ADR-0017: Design Evolution from ADR-0012

## Status

Accepted — 2026-10-08. Refines [ADR-0012](./0012-attachment-content-delivered-as-a-local-file.md).

## Context

[ADR-0012](./0012-attachment-content-delivered-as-a-local-file.md) added `redmine_attachments` to read attachments: `show` returns the metadata and `download` streams the content to a local file. Nothing in the tool surface could go the other way, so a log or a screenshot on the user's machine could not be attached to an issue.

Redmine has no single request that attaches a file. `POST /uploads.json` takes the raw content and answers with a token, and the token is then passed in `uploads` when an issue is created or updated. Until `@omochice/redmine` 3.7.0 the library could upload but could not pass a token to an issue; 3.7.0 accepts `uploads` on both issue `create` and `update`. The library's issue `create` still returns nothing, so the id of a newly created issue is not known without a further lookup.

## Decision Drivers

* **No token handling by the model**: a token the model forgets to pass on leaves content stored in Redmine and attached to nothing, and Redmine removes such uploads only when an administrator runs `rake redmine:attachments:prune`.
* **One behaviour per action**: ADR-0012 rejected an action whose behaviour and response shape depend on whether an argument is present (its option 3).
* **One concern per tool**: [ADR-0001](./0001-tool-surface-aggregation-and-schema.md) aggregates actions per Redmine resource, and a handler should not take on a boundary its resource does not need.
* **Bounded memory**: ADR-0012 keeps file content streaming so its size never bounds memory, and the upload direction should keep that property.
* **Readonly stays read-only**: `--readonly` exists so that a change to Redmine is inexpressible (ADR-0001).

## Considered Options

### Option 1: A path-taking `attachments` field on `redmine_issues`

```json
{ "update": { "id": 42, "notes": "log attached", "attachments": [{ "path": "/tmp/log.txt" }] } }
```

**Pros:**
- One call attaches a file to a new or an existing issue, and no token is shown to the model.

**Cons:**
- The issue handler gains the filesystem and the upload, so the most used tool crosses three boundaries instead of one.

### Option 2: An `upload` action returning the token, and `uploads` on `redmine_issues`

```json
{ "upload": { "path": "/tmp/log.txt" } }
```

```json
{ "update": { "id": 42, "uploads": [{ "token": "7.ed32257a2ab0f7526c0d72c32f7c7a3f" }] } }
```

**Pros:**
- Mirrors Redmine's two requests, and the same token could later serve wiki pages and news.

**Cons:**
- Every attachment takes two calls, and the model has to carry the token from one to the other.
- A token that is never passed on leaves an orphaned upload, which only an administrator's prune task removes.

### Option 3: Option 2, plus an optional `issueId` on `upload` that attaches immediately

**Pros:**
- One call for an existing issue, while a new issue can still take a token on `create`.

**Cons:**
- One action answers with a token or with an attached file depending on whether `issueId` is present, the shape ADR-0012 rejected.
- Tokens remain part of the surface, with the orphan risk of option 2 on the `create` path.

### Option 4: An `attach` action that always takes the issue (chosen)

```json
{ "attach": { "path": "/tmp/log.txt", "issueId": 42, "notes": "log attached" } }
```

```json
{ "issueId": 42, "filename": "log.txt", "filesize": 1234 }
```

**Pros:**
- One call, one behaviour, and no token ever reaches the model.
- The filesystem stays in the tool that already crosses it for `download`, and `redmine_issues` is unchanged.

**Cons:**
- A file can only be attached to an issue that already exists, so attaching to a new issue takes `create`, a lookup of the new id, and `attach`.

## Decision

We add an `attach` action to `redmine_attachments`, by option 4.

### 1. `attach` uploads and attaches in one call

**Change from**: `redmine_attachments` offers `show` and `download`.

**Change to**: it also offers `attach`, which takes `path`, `issueId`, and optionally `filename`, `description`, and `notes`, and answers with `{ issueId, filename, filesize }`. `FilePort` gains `open(path)`, which returns the file's name, size, and content as a `ReadableStream`. `AttachmentPort` gains `attach(issueId, body, { filename, description?, notes? })`, which `AttachmentClient` implements as the library's `file.upload` followed by `issue.update` with the token in `uploads` and `notes` alongside.

**Rationale**: the two Redmine requests are a transport detail, so they belong in the adapter rather than in the model's sequence of calls; the token then never leaves `AttachmentClient`. Sending `notes` in the same update records the comment and the attachment as one history entry, which is how a person attaching a log through the web UI would see it. The stream is passed through without being read into memory, keeping the bounded-memory driver of ADR-0012 in this direction too.

### 2. A new issue is not attached to in the same call

**Change from**: not applicable.

**Change to**: `attach` requires an existing issue, and its description tells the model to create the issue with `redmine_issues` first.

**Rationale**: attaching on `create` would bring the file into `redmine_issues` (option 1) or tokens back into the surface (options 2 and 3). The cost is a lookup of the new issue's id, which disappears once the library's `create` returns the created issue; that is recorded as follow-up work rather than worked around here.

### 3. `filename` defaults to the last segment of `path`

**Change from**: not applicable.

**Change to**: when `filename` is omitted, the handler records the file under `basename(path)` from `@std/path`, which this change adds as a dependency.

**Rationale**: a model that names a file by path almost always wants it shown under the same name, so a required `filename` would only repeat the path. `@std/path` was chosen over splitting on `/` because the binary also targets Windows, where the separator differs. Redmine derives the content type from the recorded name, so no `contentType` is asked for.

### 4. `--readonly` drops `attach`

**Change from (ADR-0012, decision 4)**: the attachment schema ignores the mode and advertises every action in both modes.

**Change to**: `readonly` advertises `show` and `download`; `full` adds `attach`. The tool description is built per mode, so it names `attach` only where the schema offers it.

**Rationale**: `attach` changes an issue, which ADR-0001 makes inexpressible in readonly mode. `download` stays, for the reason ADR-0012 gave: it only reads Redmine.

### 5. No `maxSize` on `attach`

**Change from**: `download` bounds its write with `maxSize`.

**Change to**: `attach` takes no size limit.

**Rationale**: `maxSize` on `download` protects the user's disk from content whose size Redmine controls. On `attach` the file is the user's own and is streamed, so neither memory nor disk grows with it, and Redmine enforces its own attachment size setting and rejects a larger upload with an error the model can read.

## Consequences

### Positive

1. **Files reach issues**: the model can attach a log or a screenshot from the user's machine to an issue, with a comment, in one call.
2. **No tokens in the surface**: the model cannot leave an upload behind by forgetting a step.
3. **Size-independent cost**: the file streams, so memory does not grow with it.

### Negative

1. **Existing issues only**: attaching to a new issue takes three calls until the library's `create` returns the issue.
2. **Orphans on a failed update**: if the upload succeeds and the issue update fails, for example because the issue does not exist or the user may not edit it, the upload stays stored and attached to nothing.
3. **The server reads local files**: any file the server process can read can be sent to Redmine, chosen by the model.
4. **Issues only**: wiki pages and news accept the same uploads in Redmine but have no way to receive a file here.

### Mitigations

- The `attach` description says that a new issue has to be created first, so the model does not look for a way to attach on `create`.
- An orphan now needs a failed update rather than a forgotten step; it cannot be deleted from here because the library's upload returns only the token, not the attachment id.
- `attach` is absent in `--readonly`, so a user who wants no data to leave the machine through the server can start it in that mode.
- A later need for wiki pages or news can be met by a target other than `issueId` on `attach`, decided when that need exists.

## Implementation Notes

- The real `LocalFile.open` runs under the unit tests' `--allow-read`, so it is covered by `src/file/local.test.ts` against a checked-in file, unlike `save`.
- `src/redmine/attachment-integration.test.ts` seeds its attachment through `AttachmentClient.attach` with a `ReadableStream` rather than bytes, and checks the description, the comment, and a failed attach to a missing issue. The library's own end-to-end tests upload a `Uint8Array`, so this test is what proves a streamed body reaches Redmine; it passed on 2026-10-08 against the Redmine 7.0 of `compose.yaml`, and CI runs it on every change.
- The failing-attach step leaves one orphaned upload in the test instance, which is the behaviour negative consequence 2 describes.

## References

- [ADR-0001](./0001-tool-surface-aggregation-and-schema.md) — per-resource aggregation and what `--readonly` prunes.
- [ADR-0007](./0007-code-structure-ports-and-modules.md) — ports and fakes, extended here with `FilePort.open`.
- [ADR-0012](./0012-attachment-content-delivered-as-a-local-file.md) — the download direction this ADR mirrors, its rejected option 3, and decision 4, which this ADR revises.
- [ADR-0015](./0015-design-evolution-from-0001.md) — the action-keyed schema the new action is advertised with.
- Redmine REST API, "Attaching files": <https://www.redmine.org/projects/redmine/wiki/Rest_api#Attaching-files>
- Redmine `Attachment.prune` and the `redmine:attachments:prune` task: `app/models/attachment.rb` and `lib/tasks/redmine.rake` in the Redmine source.
