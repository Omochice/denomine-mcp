# Contributing

This document describes how to build, test, and change `denomine-mcp`.

## Toolchain

The server is written in TypeScript for [Deno](https://deno.com/) 2, and the OS credential store is reached through a small Rust `cdylib` under `ffi/`.

Building therefore needs Deno and a Rust toolchain, at the versions pinned in `mise.toml` for [mise](https://mise.jdx.dev/).

Docker is needed only for the integration tests.

## Tasks

All routine commands are `deno task` entries defined in `deno.json`, summarized in the table below.

| Task               | Purpose                                                                      |
| ------------------ | ---------------------------------------------------------------------------- |
| `dev`              | Run the CLI from source, for example `deno task dev serve --endpoint <url>`. |
| `test`             | Run the unit tests.                                                          |
| `test:integration` | Run the unit tests and the integration tests against a live Redmine.         |
| `build:ffi`        | Build the keyring `cdylib` into `ffi/target/release/`.                       |
| `compile:bin`      | Compile the single binary, embedding the already built `cdylib`.             |
| `compile`          | Run `build:ffi` and then `compile:bin`.                                      |

## Tests

The test that exercises the real credential store is opt-in, because it writes to the store of the machine it runs on.

It runs only on macOS and Windows, and only when `DENOMINE_KEYRING_SMOKE` is set to `1`.

```sh
deno task build:ffi
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
deno task test:integration
```

See [doc/verification.md](./doc/verification.md) for the setup.

## Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

## Design records

Architecture decisions are recorded as ADRs, indexed in [doc/adr/README.md](./doc/adr/README.md).

A change that revises one of those decisions is accompanied by a new ADR rather than an edit to an accepted one.
