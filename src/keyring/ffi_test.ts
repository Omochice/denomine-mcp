import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { FfiKeyring } from "./ffi.ts";

/**
 * Whether the opt-in smoke flag is set. The `env` permission is queried first
 * because the default CI test task (`deno test --allow-read src/`) grants no
 * `--allow-env`, and reading the variable unconditionally would throw at module
 * load and fail the whole suite rather than merely skip this test.
 */
function smokeEnabled(): boolean {
  const permission = Deno.permissions.querySync({
    name: "env",
    variable: "DENOMINE_KEYRING_SMOKE",
  });
  return permission.state === "granted" &&
    Deno.env.get("DENOMINE_KEYRING_SMOKE") === "1";
}

/**
 * Exercises the real FFI wiring against the OS keychain, which the fakes cannot
 * (see ADR-0007). Gated off by default: it requires a keychain (darwin only)
 * and opt-in via `DENOMINE_KEYRING_SMOKE=1`, so normal CI stays on the fakes.
 * A unique account keeps concurrent or repeated runs from colliding.
 */
Deno.test({
  name: "FfiKeyring round-trips a secret through the OS keychain",
  ignore: Deno.build.os !== "darwin" || !smokeEnabled(),
  async fn() {
    const keyring = new FfiKeyring();
    const account = `https://denomine-mcp.test/${crypto.randomUUID()}`;
    const secret = `smoke-secret-${crypto.randomUUID()}`;

    await keyring.set(account, secret);
    try {
      assertEquals(await keyring.get(account), secret);
    } finally {
      await keyring.delete(account);
    }

    assertEquals(await keyring.get(account), undefined);
  },
});
