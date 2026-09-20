# Contributing

This document describes how to build, test, and change `denomine-mcp`.

## Toolchain

The server is written in TypeScript for [Deno](https://deno.com/) 2, and the OS credential store is reached through a small Rust `cdylib` under `ffi/`.

Building therefore needs Deno and a Rust toolchain, at the versions pinned in `mise.toml` for [mise](https://mise.jdx.dev/).

Docker is needed only for the integration tests.

## Tasks

All routine commands are `mise run` tasks defined in `mise.toml`, summarized in the table below.

| Task               | Purpose                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| `dev`              | Run the CLI from source, for example `mise run dev -- serve --endpoint <url>`. |
| `test`             | Run the unit tests.                                                            |
| `test:integration` | Run the unit tests and the integration tests against a live Redmine.           |
| `fmt`              | Format the sources.                                                            |
| `check`            | Run the format check, the linter, and the type check.                          |
| `build`            | Build the keyring `cdylib` and compile the single binary.                      |

## Tests

The test that exercises the real credential store is opt-in, because it writes to the store of the machine it runs on.

It runs only on macOS and Windows, and only when `DENOMINE_KEYRING_SMOKE` is set to `1`.

```sh
mise run build
DENOMINE_KEYRING_SMOKE=1 deno test --allow-read --allow-env --allow-ffi src/keyring/ffi.test.ts
```

Test files are named `*.test.ts` and live next to the code they test.

### Integration tests

The integration tests run against a live Redmine and are skipped unless the endpoint and the API key are given.

```sh
DENOMINE_TEST_ENDPOINT=http://localhost:3000 \
DENOMINE_TEST_API_KEY=<key> \
DENOMINE_TEST_PROJECT_IDENTIFIER=demo \
DENOMINE_TEST_SEARCH_QUERY=Demo \
mise run test:integration
```

See [doc/verification.md](./doc/verification.md) for the setup.

## Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

## Design records

Architecture decisions are recorded as ADRs, indexed in [doc/adr/README.md](./doc/adr/README.md).

A change that revises one of those decisions is accompanied by a new ADR rather than an edit to an accepted one.
