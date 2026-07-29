# ADR-0003: Store credentials in the OS keyring via a Rust `keyring` crate over FFI

## Status

Accepted (refined by [ADR-0009](./0009-design-evolution-from-0003.md)) — 2026-07-12. Carries forward the former ADR 0003.

## Context

Two hard requirements interact tightly: the API key must be stored in the OS keyring, and the tool must ship as a single binary produced by `deno compile`.

- Deno has no native keyring API.
- `keytar` and `@napi-rs/keyring` are native Node addons whose `.node` artifacts cannot be embedded in a `deno compile` binary, so they break the single-binary requirement (see [ADR-0005](./0005-single-binary-distribution-and-release.md)).
- No mature pure-Deno-FFI keyring library exists on JSR.
- Shelling out to OS CLIs (`security`, `secret-tool`) works but needs a per-OS backend and the presence of those external tools.

`deno compile --include <lib>` embeds an arbitrary file; at runtime Deno unpacks it to a temporary directory, and a path resolved with `new URL("./lib", import.meta.url).pathname` points at the extracted copy, which `Deno.dlopen` can load. This was confirmed against the current Deno FFI documentation, so an FFI dynamic library can be delivered inside a single compiled binary — which is what makes the keyring and single-binary requirements reconcilable rather than mutually exclusive.

## Decision Drivers

* **Keyring requirement**: the key must live in the OS credential store, not in plaintext or an env var.
* **Single-binary requirement**: whatever provides keyring access must be embeddable in one `deno compile` output.
* **Cross-platform reuse**: per-OS keychain logic should be reused, not reimplemented.

## Considered Options

### Option 1: `@napi-rs/keyring` or `keytar`

Native Node keyring addons consumed via Deno's Node compatibility.

**Pros:**
- Mature, ready-made keyring access.

**Cons:**
- The native `.node` addon cannot live inside a single compiled binary, breaking the single-binary requirement.

### Option 2: Subprocess to OS CLIs (`security` / `secret-tool`)

Shell out to the platform's credential CLI.

**Pros:**
- No FFI and no Rust toolchain.

**Cons:**
- Adds a per-OS branch and depends on those external tools being installed.

### Option 3: Self-written FFI to `Security.framework` / `libsecret`

Bind each platform's native credential API directly from Deno.

**Pros:**
- No extra Rust crate.

**Cons:**
- High effort, large `unsafe` surface, and a per-OS reimplementation.

### Option 4: A Rust `keyring` crate wrapped as a `cdylib`, loaded over FFI (chosen)

A thin Rust crate wraps the mature `keyring` crate behind `extern "C"` functions, compiled as a `cdylib` and embedded with `deno compile --include`.

**Pros:**
- Reuses one mature cross-platform dependency and fits inside a single binary.

**Cons:**
- Adds a Rust toolchain and a small `unsafe` FFI marshalling layer.

## Decision

### 1. Wrap the `keyring` crate behind a C ABI

A thin Rust crate exposes `extern "C"` get / set / delete functions over the mature `keyring` crate, compiled as a `cdylib`. Per-OS keychain logic is delegated to the crate rather than reimplemented.

**Rationale**: reusing one maintained cross-platform crate avoids a per-OS reimplementation, and a C ABI is the narrowest interface Deno FFI can consume.

### 2. Embed and load the `cdylib` through `deno compile --include`

The `cdylib` is embedded with `deno compile --include`, unpacked at runtime, and loaded through the `import.meta.url`-resolved path with `Deno.dlopen`.

**Rationale**: this is the mechanism that lets a dynamic library ride inside a single compiled binary, which is what makes the keyring requirement compatible with the single-binary requirement instead of trading one off against the other.

## Consequences

### Positive

1. **Both requirements satisfied**: a genuine single-file distribution that still uses the OS keyring.
2. **One maintained dependency**: cross-platform keychain handling is delegated to the `keyring` crate.

### Negative

1. **Rust toolchain in the build**: a `cdylib` must be cross-built per target and paired with each `deno compile --target` (see [ADR-0005](./0005-single-binary-distribution-and-release.md)).
2. **`unsafe` glue**: a small amount of FFI marshalling passes service / account / password strings across the boundary.
3. **Broader permissions**: unpacking the dylib to a temp directory requires `--allow-ffi`, `--allow-read`, and `--allow-write` (temp).
4. **Runtime provider on Linux**: a Secret Service provider must be available at runtime.

### Mitigations

- The subprocess-to-OS-CLIs approach (Option 2) is retained as a documented fallback should the FFI path prove unworkable on a platform.
- The `cdylib` cross-build is folded into the tagged release automation (see [ADR-0005](./0005-single-binary-distribution-and-release.md)) so the per-target build is not run by hand.
- The keyring is reached only through a port (see [ADR-0007](./0007-code-structure-ports-and-modules.md)), so the FFI details stay behind one boundary.

## Implementation Notes

A proof-of-concept exercises a keyring write→read round-trip through `Deno.dlopen` against the Rust `cdylib` to validate the FFI path before it is wired into the server. On an unsigned macOS binary the first keychain access may raise a GUI permission prompt.

## References

- [ADR-0004](./0004-cli-and-instance-selection.md) — how the endpoint URL namespaces each instance's key in the keyring.
- [ADR-0005](./0005-single-binary-distribution-and-release.md) — the single-binary distribution and the per-target `cdylib` build.
- [ADR-0007](./0007-code-structure-ports-and-modules.md) — the keyring port that hides this FFI binding from the core.
