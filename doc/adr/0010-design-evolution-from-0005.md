# ADR-0010: Design Evolution from ADR-0005

## Status

Accepted — 2026-08-03. Refines [ADR-0005](./0005-single-binary-distribution-and-release.md).

## Context

[ADR-0005](./0005-single-binary-distribution-and-release.md) settled three coupled questions about packaging: distribute only the `deno compile` single binary, target macOS arm64, macOS x64, and Linux x64, and produce those binaries from a tag-triggered GitHub Actions matrix. It deferred Windows, "until its Credential Manager behavior is verified", and bounded the target list on the grounds that each target costs CI time.

Two of the premises behind that bound have since changed. [ADR-0009](./0009-design-evolution-from-0003.md) removed the hand-written macOS keychain query that had been the only platform-specific code in the FFI binding, so every target now reaches its credential store through the same code path rather than through one path that only existed for macOS. Separately, GitHub began offering arm64 Linux runners at no cost for public repositories, which removes the reason Linux arm64 would have been the expensive entry in the matrix.

What did not change is the Windows precondition. ADR-0005 stated it as something to be observed once before Windows could ship, and left unsaid who would observe it or when. Nothing did, which is why Windows was still deferred at the point the matrix was first written.

This ADR records how ADR-0005's design evolved when the release workflow was actually built. Decision 1, distributing only the single compiled binary with one `cdylib` loading path, holds unchanged, as does the requirement that every published binary be traceable to a tagged commit. What changed is the size of the target set, how the Windows precondition is discharged, where the per-target jobs run, and what decides that a release happens at all.

## Design Changes from ADR-0005

### 1. The target set is every target `deno compile` can emit

**Original Design (ADR-0005)**: distribute macOS arm64, macOS x64, and Linux x64. Windows is deferred, and the three-target set is chosen to cover common developer platforms while bounding the CI matrix.

**Revised Design**: distribute all five targets `deno compile --target` accepts, adding `aarch64-unknown-linux-gnu` and `x86_64-pc-windows-msvc` to the three already listed.

**Rationale**: the original bound was a judgement about which platforms are common enough to be worth their CI time, and such a judgement has to be revisited every time someone asks for a platform. Deno's supported target list is a bound that needs no such judgement: it is the largest set the toolchain can produce, so there is no line left to argue about. The cost that made the smaller bound attractive also fell, because both new targets build on a runner of their own architecture and the arm64 Linux runner is free for this repository. ADR-0005's decision driver was covering common developer platforms without an unbounded matrix, and five fixed targets is not unbounded.

### 2. The Windows precondition is a standing check, not a one-off observation

**Original Design (ADR-0005)**: Windows waits until its Credential Manager behavior is verified, with the verification left as an unscheduled manual step.

**Revised Design**: the FFI smoke test in `src/keyring/ffi.test.ts`, opt-in through `DENOMINE_KEYRING_SMOKE=1`, no longer asks whether the host is macOS. It asks whether the host's credential store answers without a desktop session, which the macOS keychain and the Windows Credential Manager both do. The Windows leg of the build matrix runs that test before it compiles the binary, so a Windows artifact is produced only on a run where a secret was written to, read from, listed in, and deleted from the Credential Manager.

The Linux Secret Service stays outside that test. It needs a session D-Bus and an unlocked provider, and a hosted runner has neither, so the test would report the runner's environment rather than anything about the binding.

**Rationale**: a one-off observation answers for the machine and the crate version it was made on, and says nothing about the next release. Attaching the check to the matrix means the claim is re-established on every build instead of aging. This ADR records the mechanism, not a result: at the time of writing no CI run has taken place, so whether the Credential Manager answers on a hosted runner is what the first run establishes. If it does not, the honest correction is to return Windows to deferred.

### 3. Per-target jobs build natively and run on every change

**Original Design (ADR-0005)**: a tag-triggered workflow runs a per-target job that cross-builds the `cdylib` and runs `deno compile --target`.

**Revised Design**: each job runs on a runner of its target's architecture and builds the `cdylib` natively, then stages it at `ffi/target/release/` — the one path `src/keyring/ffi.ts` resolves — before `deno compile --target` embeds it. The single exception is macOS x64, which is built on the arm64 runner because Apple's clang links either architecture. The matrix lives in one `workflow_call` workflow that both the release workflow and a pull-request workflow invoke.

**Rationale**: `deno compile --target` cross-compiles from any host, but cargo does not do the same for these store crates without a cross toolchain per target, so the runner has to match. Staging is required because the loader resolves one fixed path and a `--target` build lands under `ffi/target/<triple>/release/` instead; putting the artifact where the loader looks keeps that path a contract the builder satisfies rather than something the loader has to reason about. Invoking the same matrix from the pull-request workflow means a broken cross-build is found while it can still be fixed, instead of once a release has already been cut.

### 4. The release is cut by release-please, not by a hand-pushed tag

**Original Design (ADR-0005)**: a GitHub Actions workflow is triggered by pushing a git tag, and its per-target job attaches the resulting binary and a checksum to a GitHub Release.

**Revised Design**: release-please runs on every push to `main` and keeps a release pull request in step with the conventional commits that have landed since the last release. Merging that pull request is what releases: release-please decides the version, writes `CHANGELOG.md`, rewrites the version literal in `src/cli/mod.ts`, creates the tag, and opens the GitHub Release. The build matrix runs in the same workflow run, gated on release-please reporting that a release was created, and uploads the five binaries and a combined `SHA256SUMS` to the release that run produced.

**Rationale**: ADR-0005 asked that every published binary be traceable to a tagged commit, and left the version number and the release notes to whoever pushed the tag. Deriving both from the commit history removes that judgement from release time and makes the commit discipline the project already follows the thing that decides the version. Keeping the build in the same run is not a preference: release-please tags with the default `GITHUB_TOKEN`, and GitHub does not start a workflow from a tag pushed by that token, so a tag-triggered build would never fire at all.

## Consequences

### Positive

1. Every platform the toolchain supports gets a binary, so a request for one is answered by the existing matrix rather than by revisiting the target decision.
2. The Windows binary carries a verified credential store on every release, because the run that produced it also exercised the Credential Manager end to end.
3. Cross-build breakage surfaces on the pull request that causes it, rather than once a release has already been cut.
4. Four of the five artifacts are executed on the runner that built them, which catches a binary that links but does not start.
5. Releasing is merging a pull request. The version and the notes come from the commit history, so neither has to be remembered or hand-written.

### Negative

1. The macOS x64 artifact is the one nobody runs. It is cross-built on an arm64 runner that has no Rosetta, so nothing between `deno compile` and a user's machine executes it.
2. The Linux binaries ship a Secret Service path that CI never exercises, which is the gap [ADR-0009](./0009-design-evolution-from-0003.md) recorded and this ADR narrows only for Windows.
3. Five legs now run on every pull request rather than three legs on every tag, which is more CI time than ADR-0005's cost driver contemplated.
4. Windows support now depends on a hosted runner continuing to provide a working Credential Manager. That dependency is visible as a red build rather than a silent regression, but it is a dependency the other targets do not have.
5. The GitHub Release is published before its binaries exist, so for the length of the matrix it is visible with no assets. Marking it a draft would close that window, but a draft release creates no git tag, and the tag is what the upload step addresses.
6. The release pull request is authored by `GITHUB_TOKEN`, which does not start the pull-request workflow, so its contents are first checked only after it lands on `main`.

### Mitigations

- The Rust build is cached per target, so the added legs pay for a full dependency-tree build only when the lockfile or toolchain changes.
- The target matrix stays data-driven in one `workflow_call` workflow invoked by both the release and pull-request workflows, so removing a target if it proves unsustainable is a deleted matrix entry.
- The release pull request changes only the changelog, the manifest, and one version literal, so the checks it does not run are checks with nothing to say about it.

## References

- [ADR-0005](./0005-single-binary-distribution-and-release.md) — the distribution and release decision this ADR refines.
- [ADR-0009](./0009-design-evolution-from-0003.md) — the evolution that removed the binding's macOS-only code path, and which recorded the Windows and Secret Service paths as unrun.
- [ADR-0003](./0003-credential-storage-in-os-keyring-via-ffi.md) — the `cdylib` that every target in the matrix must build and embed.
