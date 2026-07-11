# Architecture Decision Records

This directory records the architecture decisions for the Redmine MCP server (`denomine-mcp`). Each record captures one decision, its context, the alternatives considered, and its consequences, in the t-wada ADR style. The records are listed below; all are Accepted except ADR-0006, which stays Proposed until its proof-of-concept resolves it.

- [ADR-0001: Tool surface — per-resource aggregation, `--readonly` pruning, and valibot schema](0001-tool-surface-aggregation-and-schema.md)
- [ADR-0002: Handler response and error mapping](0002-handler-response-and-error-mapping.md)
- [ADR-0003: Store credentials in the OS keyring via a Rust `keyring` crate over FFI](0003-credential-storage-in-os-keyring-via-ffi.md)
- [ADR-0004: CLI — instance selection by endpoint URL, credential subcommands, and cliffy](0004-cli-and-instance-selection.md)
- [ADR-0005: Single-binary distribution, targets, and release automation](0005-single-binary-distribution-and-release.md)
- [ADR-0006: MCP implementation base and transport](0006-mcp-base-and-transport.md) (Proposed)
- [ADR-0007: Code structure — ports, fakes, and role-based modules](0007-code-structure-ports-and-modules.md)

These seven records consolidate an earlier set of sixteen finer-grained ADRs; each record notes in its Status which of the former ADRs it carries forward.
