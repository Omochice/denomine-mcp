# ADR-0014: Bundle the compiled binary with `deno compile --bundle`

## Status

Accepted — 2026-09-27.

## Context

[ADR-0005](./0005-single-binary-distribution-and-release.md) distributes one binary produced by `deno compile`. Without further flags, `deno compile` embeds every npm package in the resolved snapshot, each as a whole directory, whether or not the entry point reaches its code.

While listing third-party notices for [ADR-0013](./0013-third-party-licenses-embedded-in-the-binary.md), the embedded file tree of the aarch64-apple-darwin binary showed two packages that no module imports:

```
@typescript/typescript-darwin-arm64/* (26.22MB)
typescript/7.0.2/* (2.39MB)
```

They come from `@praha/byethrow`, which declares `"peerDependencies": { "typescript": ">=5.0.0" }` without marking it optional. Its `dist/` never imports `typescript`; the peer states the minimum compiler version for its type definitions, which use `const` type parameters. A non-optional peer is resolved, so about 29 MB of a 119 MB binary is a compiler that never runs.

## Decision Drivers

* **Binary size**: every user downloads the binary, once per target.
* **Keep the single binary**: ADR-0005 still holds; the fix should not add a second artifact or loading path.
* **Do not wait on upstream**: a change the project can make now is preferred over one that depends on another project's release.

## Considered Options

### Option 1: `--exclude-unused-npm`

**Pros:**
- Stable flag, no change to the code.

**Cons:**
- It walks package dependencies from the imported packages, and `typescript` is a dependency of `@praha/byethrow`, so it stays. The binary size did not change.

### Option 2: `--exclude` the TypeScript packages

**Pros:**
- Targets exactly the unwanted packages.

**Cons:**
- It applies to a local `node_modules` directory. Against the global npm cache this project uses it had no effect, and switching to `--node-modules-dir` changes how every dependency is resolved.
- Every future package like this would need its own entry.

### Option 3: Ask upstream to mark the peer optional

With `"peerDependenciesMeta": { "typescript": { "optional": true } }`, Deno does not resolve the peer. A scratch project using `valibot`, which already declares it that way, compiled without TypeScript.

**Pros:**
- Fixes the cause for every consumer.

**Cons:**
- Depends on an upstream release, and only fixes this one package.

### Option 4: `deno compile --bundle` (chosen)

`--bundle` runs esbuild on the entry point and embeds the result instead of the npm package tree.

**Pros:**
- Only reachable code is embedded, whatever any package declares.
- The aarch64-apple-darwin binary went from 119,080,322 to 69,412,226 bytes.

**Cons:**
- The flag is marked experimental and may change.
- Dynamic `require` and `import` patterns that cannot be traced statically are dropped.
- Every module's `import.meta.url` becomes the bundle file at the root of the embedded file system, which broke the two places that located an embedded file with `../../` from `src/`.

## Decision

We will compile with `--bundle` and resolve embedded files from a module at the repository root.

### 1. `task/compile.ts` passes `--bundle`

**Change from**: `deno compile --allow-ffi ... main.ts`

**Change to**: `deno compile --bundle --allow-ffi ... main.ts`

**Rationale**: it is the only option that removes the unused code without depending on how each package declares its dependencies, and it works today. An upstream report (option 3) is still worth sending, but the build does not rely on it.

### 2. Embedded files are resolved through `root.ts`

**Change from**:

```ts
new URL(`../../ffi/target/release/${dylibName()}`, import.meta.url);
```

**Change to**:

```ts
// root.ts, at the repository root
export function fromRoot(path: string): URL {
  return new URL(path, import.meta.url);
}

// src/keyring/ffi.ts
fromRoot(`ffi/target/release/${dylibName()}`);
```

**Rationale**: a module at the root has the same `import.meta.url` directory from source, in a plain compile, and in a bundle, because the bundle is placed at the root. `Deno.mainModule` also survives bundling, but under `deno test` it names the test file, which breaks `src/keyring/ffi.test.ts` on the Windows build leg.

## Consequences

### Positive

1. **Smaller binaries**: about 50 MB less on aarch64-apple-darwin, and packages that ship unused code no longer cost anything.
2. **Upstream-independent**: no waiting on `@praha/byethrow`.

### Negative

1. **Experimental flag**: a Deno upgrade could change or break bundling.
2. **Location constraint**: `root.ts` has to stay at the repository root, which nothing but its comment enforces.
3. **Untraceable imports are lost**: a dependency that loads code dynamically would fail at run time rather than at build time.
4. **Notices over-include**: the ADR-0013 generator still walks the npm snapshot, so `typescript` is listed although it is no longer shipped.
5. **Windows needs the Deno cache on the checkout's drive**: Deno rewrites absolute `.js` path literals in the bundle into `__internalResolveBundlePath(...)` calls, assuming esbuild's `__commonJS` module keys are always relative. When the checkout and the Deno cache are on different drives, esbuild can only write those keys as absolute paths, the rewrite turns them into calls, and `deno compile` fails with a `SyntaxError`. This hit the Windows build leg, whose checkout is on `D:` and default cache on `C:`, and would hit a local Windows build set up the same way.

### Mitigations

- The build matrix smoke-runs `--help` and `license` on every target its runner can execute (all but x86_64-apple-darwin), so a bundling regression fails CI before a release.
- The MCP server was exercised from a bundled binary over stdio (`initialize`, `tools/list`, `tools/call`), and cross-compiling with `--bundle` from macOS succeeded for Linux and Windows targets; every build leg, Windows included, now bundles on its own runner in CI.
- The Windows build leg sets `DENO_DIR` under `RUNNER_TEMP`, which is on the checkout's drive. A local Windows build on split drives needs the same `DENO_DIR` setting; the fix belongs upstream in Deno's rewrite, which the build does not work around further.
- Listing an unshipped package's notice is harmless; narrowing the generator to bundled code can come later.

## References

- [ADR-0005](./0005-single-binary-distribution-and-release.md) — the single-binary distribution this keeps.
- [ADR-0013](./0013-third-party-licenses-embedded-in-the-binary.md) — the notices whose inventory exposed the embedded TypeScript.
- `praha-inc/byethrow` commit `1fd15a6` — "Make it require TypeScript v5 or higher", which added the peer.
