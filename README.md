# denomine-mcp

`denomine-mcp` is a [Model Context Protocol](https://modelcontextprotocol.io/) server for [Redmine](https://www.redmine.org/).

The API key is kept in the OS credential store listed below, so it never has to be written in an environment variable.

| OS      | Credential store                                                                            |
| ------- | ------------------------------------------------------------------------------------------- |
| macOS   | Keychain                                                                                    |
| Windows | Credential Manager                                                                          |
| Linux   | A running Secret Service provider, such as GNOME Keyring or KWallet                         |
| WSL     | Credential Manager, by running the Windows binary as `denomine-mcp.exe` through WSL interop |

## Prerequisites

The Redmine REST API must be enabled by an administrator under "Administration > Settings > API".

## Installation

Prebuilt binaries are attached to each [GitHub release](https://github.com/Omochice/denomine-mcp/releases).

The relationship between platform and asset is as follows:

| Platform              | Asset                                     |
| --------------------- | ----------------------------------------- |
| macOS (Apple silicon) | `denomine-mcp-aarch64-apple-darwin`       |
| macOS (Intel)         | `denomine-mcp-x86_64-apple-darwin`        |
| Linux (x86_64)        | `denomine-mcp-x86_64-unknown-linux-gnu`   |
| Linux (arm64)         | `denomine-mcp-aarch64-unknown-linux-gnu`  |
| Windows (x86_64)      | `denomine-mcp-x86_64-pc-windows-msvc.exe` |

## Subcommands

### `login`

`login` stores the API key for an endpoint.

```sh
denomine-mcp login --endpoint https://redmine.example.com
# or
printf '%s' "$REDMINE_API_KEY" | denomine-mcp login --endpoint https://redmine.example.com
```

### `list`

`list` prints the endpoints that have a stored key.

```console
$ denomine-mcp list
https://redmine.example.com
https://redmine.other.example.com
```

### `logout`

`logout` deletes the key for one endpoint.

```console
$ denomine-mcp logout --endpoint https://redmine.other.example.com
Removed API key for https://redmine.other.example.com.
```

### `serve`

`serve` launches the MCP server.

```sh
denomine-mcp serve --endpoint https://redmine.example.com
```

`serve` fails at startup when no key is stored for the endpoint, so run `login` first.

Adding `--readonly` to the `serve` arguments exposes only the read actions.

## Configuring an MCP client

Register `denomine-mcp serve` as a stdio server in the MCP client.

Most clients accept a configuration in the following JSON.

```json
{
  "mcpServers": {
    "redmine": {
      "command": "denomine-mcp",
      "args": ["serve", "--endpoint", "https://redmine.example.com"]
    }
  }
}
```

## Contributing

If you want to build, see [CONTRIBUTING.md](./CONTRIBUTING.md).
