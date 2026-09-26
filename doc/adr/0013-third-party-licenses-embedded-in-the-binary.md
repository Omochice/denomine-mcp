# ADR-0013: Embed third-party license texts in the binary and print them with `license`

## Status

Accepted — 2026-09-27.

## Context

The project ships only a compiled binary (see [ADR-0005](./0005-single-binary-distribution-and-release.md)). That binary carries third-party code from three sources: JSR packages such as `@cliffy/command`, npm packages pulled in by `@modelcontextprotocol/sdk` and `@praha/byethrow`, and the Rust crates linked into the `keyring_ffi` cdylib (see [ADR-0003](./0003-credential-storage-in-os-keyring-via-ffi.md)).

Most of those licenses make redistribution conditional on reproducing a notice. MIT requires that "the above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software". BSD-2-Clause and BSD-3-Clause require that a binary redistribution reproduce the notice "in the documentation and/or other materials provided with the distribution". Apache-2.0 requires a copy of the license and the contents of any `NOTICE` file. Until now the release attached nothing but the binaries and `SHA256SUMS`, so none of these conditions was met.

A plain list of package names and SPDX identifiers does not satisfy them either, because the notice these licenses ask for is the license text with its copyright line.

The set of third-party code is also not one fixed list. The Rust dependencies differ per target: macOS links `apple-native-keyring-store` and the `security-framework` crates, Linux links the `zbus` secret-service store, and Windows links its own store.

## Decision Drivers

* **Satisfy the notice conditions**: the full license text, including copyright lines, has to travel with each distributed binary.
* **Stay a single binary**: ADR-0005 made one self-contained executable the distribution, so the notices should not depend on a second file the user may not have.
* **Match what is actually shipped**: the notices should cover the code inside a given binary, which varies per target, and exclude development-only dependencies.
* **Do not go stale**: a Renovate update must not leave the notices describing an older dependency set.
* **Keep checks offline**: `deno check`, `deno lint`, and the unit tests currently need no network, and should keep it that way.

## Considered Options

### Option 1: Print names, versions, and SPDX identifiers only

```
@cliffy/command 1.3.1 MIT
ajv 8.20.0 MIT
```

**Pros:**
- Small, and needs only metadata.

**Cons:**
- Does not reproduce the copyright notice, so it does not meet the conditions above.

### Option 2: Commit a generated license file to the repository

**Pros:**
- Changes to the notices are visible in review.

**Cons:**
- Every Renovate update changes the dependency set, so the file goes stale unless each update pull request regenerates it, and CI would have to fail the ones that do not.
- One committed file cannot match five targets whose Rust dependencies differ.

### Option 3: Generate at compile time and import the JSON as a module

```ts
import licenses from "../../third-party-licenses.json" with { type: "json" };
```

**Pros:**
- `deno compile` bundles the data through the module graph without `--include`.

**Cons:**
- The file becomes part of the module graph, so `deno check`, `deno lint`, and `deno test` fail until it is generated, and generating it needs the network.

### Option 4: Generate at compile time and embed the file with `--include` (chosen)

`task/compile.ts` runs the generator for the requested target, then passes the result to `deno compile --include`. The `license` subcommand reads the embedded file at run time.

**Pros:**
- The notices match the binary they ship in, per target.
- Only compilation needs the network; checks and unit tests stay offline.

**Cons:**
- `deno task dev license`, which runs from source, has no file to read until the generator has been run once.

### Option 5: Attach a separate notices file to each release

**Pros:**
- The binary stays unchanged.

**Cons:**
- A user who copies only the binary loses the notices, which works against the single-binary distribution.

## Decision

We will generate the third-party notices at compile time for each target, embed them in the binary with `--include`, and print them with a `license` subcommand.

### 1. The dependency set comes from the module graph and `cargo metadata`, not from the lockfiles

**Change from**: no inventory of shipped dependencies.

**Change to**:

- JSR packages: the `jsr.io` modules in `deno info --json main.ts`, grouped by `@scope/name@version`.
- npm packages: the npm modules in the same graph and their transitive `dependencies` from `npmPackages`.
- Rust crates: the resolved packages of `cargo metadata --format-version 1 --filter-platform <triple>`, except `keyring_ffi` itself.

**Rationale**: `deno.lock` also records development-only packages such as `@std/expect`, and `Cargo.lock` records every target's store at once. The graph and the platform-filtered metadata describe what one binary contains.

### 2. License texts are read from the package itself

**Change to**:

- JSR: the `LICENSE` file listed in `https://jsr.io/@scope/name/<version>_meta.json`, fetched from the registry.
- npm: the license files in the package directory reported by `localPath`.
- Rust: the license files next to the crate's `Cargo.toml`.

A `NOTICE` file is included when the package has one. Each package is headed by its name and version only; no SPDX identifier is printed, because the text already states the license and JSR records no identifier to print.

**Rationale**: the copyright line exists only in the file each package ships, so no registry field could replace it. JSR exposes no license field in its API, and its files are not in the local cache unless a module imported them, so JSR is the one source read over the network.

### 3. A dual-licensed package is listed under MIT

For an expression such as `MIT OR Apache-2.0`, only the MIT text is embedded.

**Rationale**: an `OR` expression lets the redistributor choose which license to comply with, and the MIT text is the shorter one and carries its copyright line in the file itself, whereas the `LICENSE-APACHE` files in these crates are the bare license without one.

### 4. The data is embedded with `--include` and read at run time

**Change from**: `deno compile --include ffi/target/release/<cdylib>`.

**Change to**: `task/license.ts --target <triple>` writes `third-party-licenses.json` at the repository root, which is gitignored, and `task/compile.ts` also passes `--include third-party-licenses.json`. The command resolves the file relative to its own module, the same way `src/keyring/ffi.ts` resolves the cdylib.

**Rationale**: this keeps generation, and its network access, confined to compilation, which is the only step that produces something distributed.

### 5. The Deno runtime is not listed for now

**Rationale**: the runtime and the libraries it links, such as V8, are also inside the binary and carry notice conditions of their own. They are left out of this decision to keep its scope to the project's own dependencies, and remain a known gap.

## Consequences

### Positive

1. **Notices ship with the binary**: every distributed binary can reproduce the license texts of the packages it contains.
2. **Per-target accuracy**: each binary lists the Rust crates linked for its own target.
3. **No drift**: the notices are rebuilt from the current dependency set on every compilation, so a Renovate update cannot leave them behind.

### Negative

1. **Compilation needs the network**: fetching JSR license files adds a network dependency to `compile:bin`, and a JSR outage fails the release build.
2. **Larger binary**: the license texts add to the size of every binary.
3. **Running from source needs a manual step**: `license` fails under `deno task dev` until the generator has been run.
4. **The Deno runtime is not covered**: its notices remain missing from the output.
5. **Changes are not reviewed**: because the file is generated, a new license in the dependency tree does not appear in any diff.

### Mitigations

- The build matrix already needs the network for crates and npm packages, and a failure surfaces in the release run before anything is published.
- The command reports which file is missing and how to generate it when run from source.
- The Deno runtime gap is recorded here, so adding it later is a new source in the generator rather than a new design.
- The CI smoke run can execute `license` on each target, so a binary that embeds nothing fails the build.

## References

- [ADR-0003](./0003-credential-storage-in-os-keyring-via-ffi.md) — the `keyring_ffi` cdylib whose crates are listed.
- [ADR-0005](./0005-single-binary-distribution-and-release.md) — the single-binary distribution this decision keeps.
- [MIT License](https://opensource.org/license/mit), [BSD-3-Clause](https://opensource.org/license/bsd-3-clause), [Apache-2.0 section 4](https://www.apache.org/licenses/LICENSE-2.0#redistribution) — the notice conditions quoted above.
