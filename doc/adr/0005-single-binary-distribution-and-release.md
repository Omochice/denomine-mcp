# ADR-0005: Single-binary distribution, targets, and release automation

## Status

Accepted (refined by [ADR-0010](./0010-design-evolution-from-0005.md)) — 2026-07-12. Consolidates the former ADRs 0010 (single-binary only), 0008 (distribution targets), and 0012 (release automation).

## Context

The requirement is a single-binary distribution, and the keyring `cdylib` (see [ADR-0003](./0003-credential-storage-in-os-keyring-via-ffi.md)) must ride inside it. This forces three coupled decisions about packaging and release:

- Whether to offer any installation path besides the compiled binary. Also supporting `deno install` or `deno run jsr:...` would split the `cdylib` loading logic into two paths, because the `--include`-embedded copy exists only in a compiled binary and a jsr-run process would have to locate or fetch the `cdylib` separately.
- Which targets to distribute. Each distributed binary needs a matching `cdylib` cross-built for its target, so the number of targets drives the CI cost directly.
- How the binaries are produced. Each target requires a cross-built `cdylib` plus a matching `deno compile --target`, and producing several binaries by hand is not reproducible.

## Decision Drivers

* **Single-binary requirement**: the primary distribution is one self-contained executable.
* **One `cdylib` loading path**: avoid a second, separately-verified way to locate the keyring library.
* **Cover common developer platforms**: without an unbounded CI matrix.
* **Reproducible releases**: every published binary must be traceable to a tagged commit.

## Considered Options

### Option 1: Also offer `deno install` / `deno run jsr:...`

Publish to JSR and support running without compiling.

**Pros:**
- The convenience of `deno run jsr:...`.

**Cons:**
- Introduces a second `cdylib` loading path (fetch/locate rather than embed-and-extract) and doubles verification.

### Option 2: Single compiled binary only (chosen)

Distribute only the `deno compile --include` binary; keep the `cdylib` loader behind an abstraction.

**Pros:**
- Exactly one `cdylib` loading path, so implementation and verification stay simple.

**Cons:**
- The `deno run jsr:...` convenience is not offered.

For the target matrix, macOS-arm64-only was rejected (too narrow) and all-OSes-including-Windows was deferred (requires verifying Windows Credential Manager and carries the heaviest CI matrix). For production, manual local builds were rejected (weak reproducibility and history) and deferring automation was rejected (a multi-target matrix is error-prone by hand).

## Decision

### 1. Distribute only the single compiled binary

The project distributes only the `deno compile --include` single binary. There is no `deno install` or jsr-run path for now, and the `cdylib` loader is kept behind an abstraction so a second path could be added later without rewriting call sites.

**Rationale**: keeping exactly one `cdylib` loading path is what keeps implementation and verification simple; the loader abstraction preserves room to add a jsr path later without paying for it now.

### 2. Target macOS arm64, macOS x64, and Linux x64

The project distributes single binaries for macOS arm64, macOS x64, and Linux x64. Windows is deferred.

**Rationale**: this three-target set covers the common developer platforms while bounding the CI matrix; Windows waits until its Credential Manager behavior is verified.

### 3. Automate release builds on git tag

A GitHub Actions workflow is triggered by pushing a git tag. A per-target job cross-builds the `cdylib`, runs `deno compile --target`, and attaches the resulting binary and a checksum to a GitHub Release.

**Rationale**: tying the build to a tag makes every published binary traceable to a tagged commit and removes the error-prone hand-run of a three-target matrix.

## Consequences

### Positive

1. **Simple loading**: only the embed-and-extract `cdylib` path exists, so it is the only one to verify.
2. **Common platforms covered**: macOS (arm64/x64) and Linux x64 users are served.
3. **Reproducible, traceable releases**: every published binary is tied to a tagged commit and carries a checksum.

### Negative

1. **No jsr convenience**: `deno run jsr:...` and `deno install` are not offered.
2. **Windows unsupported**: Windows users are unsupported until a later iteration.
3. **CI toolchains**: CI must provision the Rust cross-compilation toolchains for each target and pair each `cdylib` with the corresponding `deno compile --target`.

### Mitigations

- The `cdylib` loader is kept behind an abstraction, so a jsr-run path can be added later without rewriting call sites.
- The target matrix is data-driven in the workflow, so adding Windows later is a matrix entry plus Credential Manager verification rather than a restructure.

## References

- [ADR-0003](./0003-credential-storage-in-os-keyring-via-ffi.md) — the keyring `cdylib` this distribution must embed and cross-build.
