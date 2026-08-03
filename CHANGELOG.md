# Changelog

## [0.1.1](https://github.com/Omochice/denomine-mcp/compare/v0.1.0...v0.1.1) (2026-08-03)


### Continuous Integration

* draft the release before attaching binaries ([#5](https://github.com/Omochice/denomine-mcp/issues/5)) ([43c57f4](https://github.com/Omochice/denomine-mcp/commit/43c57f455e4a2659d4e32a73703fbf3b5fceeb2d))

## 0.1.0 (2026-08-03)


### Features

* add list to the keyring port ([187ee21](https://github.com/Omochice/denomine-mcp/commit/187ee21a1fc1a66c4cf5375bb89d2751ce7dc309))
* add the issue tool schema and handler ([bd81163](https://github.com/Omochice/denomine-mcp/commit/bd81163ea096a2e1694579351cda2ab213f8b9de))
* add the issue-relation tool schema and handler ([b5f0606](https://github.com/Omochice/denomine-mcp/commit/b5f06064d138285ba11d50e4551261518434086a))
* add the MCP server exposing the issue tool ([b98272b](https://github.com/Omochice/denomine-mcp/commit/b98272b16201398b45d284764bf3ef69fe3f0c51))
* add the OS-keyring credential store over FFI ([8735008](https://github.com/Omochice/denomine-mcp/commit/87350086c7ce6ed78c1fe00086c1d02594af2634))
* add the Redmine issue client behind a port ([dab3231](https://github.com/Omochice/denomine-mcp/commit/dab32311d742402810628bbd67629141be2721fb))
* add the Redmine issue-relation client behind a port ([4411802](https://github.com/Omochice/denomine-mcp/commit/4411802c56b1a191701dfa3705e43197e3597643))
* add the Redmine search port backed by @omochice/redmine ([93aeb1e](https://github.com/Omochice/denomine-mcp/commit/93aeb1e10a6911fbb36acc2de5c3e74120ef53cc))
* add the Redmine version client behind a port ([1424bb6](https://github.com/Omochice/denomine-mcp/commit/1424bb6d4d29c4b8a5e0517767a93b10cb8a5288))
* add the Redmine wiki client behind a port ([9d0afbe](https://github.com/Omochice/denomine-mcp/commit/9d0afbeaaedb36566962a21d949a9677a9113641))
* add the version tool schema and handler ([e28c5e7](https://github.com/Omochice/denomine-mcp/commit/e28c5e75c2b0bd627d82a3c1b85253cff4428879))
* add the wiki tool schema and handler ([0a00912](https://github.com/Omochice/denomine-mcp/commit/0a00912231172cb010e10b1725252d9757e8fd27))
* canonicalize the endpoint URL for instance identity ([66c6eae](https://github.com/Omochice/denomine-mcp/commit/66c6eae7b055b30c0aaa0a077a567a4a665bbc2e))
* drop write verbs from tool descriptions in readonly mode ([d830b51](https://github.com/Omochice/denomine-mcp/commit/d830b51550071d29993e331a3dc927cd13f430c6))
* enumerate keychain accounts in the cdylib ([715379e](https://github.com/Omochice/denomine-mcp/commit/715379e100ea47804d217710e09ffeb1c5d33eaa))
* expose the issue-relation tool from serve ([13958c4](https://github.com/Omochice/denomine-mcp/commit/13958c4b7be28eebfb1baf3e5961a64602ef1edc))
* expose the Redmine search tool over MCP ([c6105a8](https://github.com/Omochice/denomine-mcp/commit/c6105a844f4711a40f4ecc8269342ebca02d51ff))
* expose the version tool from serve ([f12f60e](https://github.com/Omochice/denomine-mcp/commit/f12f60eec3413ec79fb86e272a9df2d66c2a11c1))
* expose the wiki tool from serve ([3daba08](https://github.com/Omochice/denomine-mcp/commit/3daba0860b43bcf55ec0da2e7ecb3cff90bfd392))
* fetch attachments and relations with the issue list ([d0efdb5](https://github.com/Omochice/denomine-mcp/commit/d0efdb5562cc4a7a9186954f4258a1dd3c07c80d))
* **ffi:** enumerate credentials through the keyring stores ([f801dba](https://github.com/Omochice/denomine-mcp/commit/f801dba7ce506a95960bb568fc828aca5c40644c))
* **ffi:** report an unavailable credential store distinctly ([dfeba29](https://github.com/Omochice/denomine-mcp/commit/dfeba29b5f43482798998624c85cb1b233b7374d))
* filter the issue list by date ([1a7af4b](https://github.com/Omochice/denomine-mcp/commit/1a7af4b623a2e29217e5963ff046d769af4e3600))
* filter the issue list by fixed version ([e2ba9c0](https://github.com/Omochice/denomine-mcp/commit/e2ba9c03aa7cbc52abc708ffccb46e0bb857f730))
* implement the list subcommand ([b8a80a2](https://github.com/Omochice/denomine-mcp/commit/b8a80a220f8c432226efb83808b54d02c035cf9d))
* initialize ([c41b171](https://github.com/Omochice/denomine-mcp/commit/c41b1710315c702823b63abc22e33199119d9374))
* name each date filter form in the advertised schema ([3d8327a](https://github.com/Omochice/denomine-mcp/commit/3d8327adecc7d9475960a52baf2b1cb33ca049e3))
* read an issue's journals and other associations with show ([194c58a](https://github.com/Omochice/denomine-mcp/commit/194c58a29e702f87821afa9fb70a895c12af131d))
* scaffold the CLI with stubbed serve/login/logout/list subcommands ([8d8755b](https://github.com/Omochice/denomine-mcp/commit/8d8755b5061dee0cb99e0fb82cb80512f80d2b20))
* wire serve, login, and logout to the keyring and Redmine ([61144f7](https://github.com/Omochice/denomine-mcp/commit/61144f7c333da6bf6da039930301ce8c1e1a3bbd))


### Bug Fixes

* adapt version dueDate to the library's Date type ([8f28425](https://github.com/Omochice/denomine-mcp/commit/8f28425eb6966cb0a04ffcb10e60e01c06f25d69))
* refuse a date the calendar does not have ([390fa5d](https://github.com/Omochice/denomine-mcp/commit/390fa5d2720ca46ee6ca3aa2ce93ce07b23e058d))
