# ADR-0009: Design Evolution from ADR-0003

## Status

Accepted — 2026-07-29. Refines [ADR-0003](./0003-credential-storage-in-os-keyring-via-ffi.md).

## Context

[ADR-0003](./0003-credential-storage-in-os-keyring-via-ffi.md) chose to wrap the Rust `keyring` crate behind a C ABI, compile it as a `cdylib`, and load it from Deno, so that per-OS keychain logic would be delegated to one maintained dependency rather than reimplemented. That choice rested on the crate covering every operation the `Keyring` port needs.

It did not cover one. The `keyring` crate as used at the time had no way to enumerate stored credentials, so `keyring_list` reached past it into the macOS Security framework through `security-framework`, requesting every generic password's attributes and matching the service in code. That one function was the only part of the binding that reimplemented per-OS keychain logic, and it was the only reason the binding was macOS-only while every other operation already went through a cross-platform crate.

The `keyring` crate's version 4 removed that premise. It moved the entry API into a separate `keyring-core` crate, which exposes `Entry::search` and `Entry::get_specifiers`, so enumeration became an operation the credential stores themselves answer.

This ADR records how the design in ADR-0003 evolved to keep its decision drivers — delegate per-OS keychain logic, and fit inside a single compiled binary — intact against the new crate layout. Decision 2 of ADR-0003, embedding the `cdylib` with `deno compile --include` and loading it through an `import.meta.url`-resolved path, still holds unchanged. What changed is which crates the wrapper is built on and how it enumerates.

## Design Changes from ADR-0003

### 1. The wrapper is built on `keyring-core` and the per-target store crates

**Original Design (ADR-0003)**: a thin Rust crate exposes `extern "C"` functions over the mature `keyring` crate, which resolves its backend from a feature flag (`apple-native`).

**Revised Design**: the crate depends on `keyring-core` together with one store crate per target, selected by `cfg` expressions in `Cargo.toml`: `apple-native-keyring-store` on Apple platforms, `windows-native-keyring-store` on Windows, and `zbus-secret-service-keyring-store` on other Unix systems. The `keyring` facade itself is not a dependency.

**Rationale**: the facade re-exports only its `v1` module, which has no search. Its `cli` feature does expose one, but also pulls in the sqlite-backed `db-keystore`, taking the `cdylib` from 569 KB to 14.5 MB — weight a single-binary distribution would carry on every target for a store it never uses. The facade's own `v1` documentation directs anything needing more than `v1` at `keyring-core` plus the desired stores, which is the shape adopted here. The per-OS keychain logic is still delegated, which is what ADR-0003 asked for; only the layer it is reached through changed.

### 2. Enumeration goes through the store instead of the Security framework

**Original Design (ADR-0003)**: `keyring_list` queries the macOS keychain directly through `security-framework`, loading every generic password's attributes and comparing the `svce` attribute in code, because enumeration is not exposed by the crate.

**Revised Design**: `keyring_list` calls `Entry::search` with an empty spec and recovers each account from `Entry::get_specifiers`, keeping the entries whose service matches. `security-framework` is no longer a dependency.

The spec is left empty rather than carrying the service, because the stores disagree on how a service is expressed: the Apple store takes a `service` key, while the Windows store takes only a regular expression over the whole target name and rejects `service` as invalid. An empty spec means "every credential" in both, which is the one request all of them understand, and matching in code is what this function already did.

**Rationale**: the hand-written query was the single place where the binding reimplemented per-OS keychain logic, accepted at the time only because no alternative existed. Removing it makes listing behave like every other operation in the binding and removes the reason the binding could not run anywhere but macOS.

### 3. Registering the credential store becomes the wrapper's responsibility

**Original Design (ADR-0003)**: the crate resolves its backend from feature flags at compile time, so the wrapper calls the entry constructor directly with no setup step.

**Revised Design**: `keyring-core` holds no default store until one is installed, so every exported function first passes through a `std::sync::Once` that constructs the platform's store and hands it to `keyring_core::set_default_store`. On Linux the Secret Service store is chosen rather than kernel keyutils.

**Rationale**: a `cdylib` has no initialisation hook of its own, and the C ABI gives the Deno caller nowhere to perform one without adding a function it could forget to call, so the guard belongs inside the exported functions. The Secret Service is chosen because keyutils keys do not outlive the session, and a credential that disappears at logout is not the persistent keyring ADR-0003 requires.

## Consequences

### Positive

1. No part of the binding reimplements per-OS keychain logic, which is the delegation ADR-0003 sought and did not fully achieve.
2. The `cdylib` carries `keyring-core` and only the one store its target needs, staying within a few hundred kilobytes for a single-binary distribution.
3. The C ABI and the `Keyring` port above it are unchanged, so the evolution is invisible outside the FFI crate.
4. Credentials stored by the previous build remain usable. This was verified on macOS: a credential written by the `keyring` v3 binding is read, listed, and deleted unchanged by the current one.

### Negative

1. The wrapper now names each platform's store itself, once in `Cargo.toml` and once in the registration branch, which the facade previously hid.
2. Only macOS is verified. The Windows and Secret Service paths are reached by the same code but have not been run, and [ADR-0005](./0005-single-binary-distribution-and-release.md) still defers Windows as a distribution target.
3. Listing asks the store for every credential and filters afterwards rather than narrowing the query, so a large keychain is walked in full. This matches the cost of the original implementation rather than adding to it.
4. Listing is now scoped to the keychain the store is configured for, where the original searched the platform's default search list. Credentials this project writes are unaffected, because writes and reads go through that same store, and a credential written by the previous build was confirmed to still be listed. A credential placed in another keychain by other means would no longer appear.

## References

- [ADR-0003](./0003-credential-storage-in-os-keyring-via-ffi.md) — the keyring-over-FFI decision this ADR refines.
- [ADR-0005](./0005-single-binary-distribution-and-release.md) — the distribution targets, which still exclude Windows.
- [ADR-0007](./0007-code-structure-ports-and-modules.md) — the keyring port that keeps this binding behind one boundary.
