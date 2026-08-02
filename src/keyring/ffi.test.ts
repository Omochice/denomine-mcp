import { expect } from "jsr:@std/expect@1.0.20";
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
 * Whether the host's credential store works without a desktop session.
 *
 * The macOS keychain and the Windows Credential Manager both do, so a hosted CI
 * runner can exercise them. The Linux Secret Service cannot: it needs a session
 * D-Bus and an unlocked provider, and without them this test would report the
 * environment's absence rather than anything about the binding.
 */
function headlessStore(): boolean {
  return Deno.build.os === "darwin" || Deno.build.os === "windows";
}

/**
 * Exercises the real FFI wiring against the OS credential store, which the
 * fakes cannot (see ADR-0007). Gated off by default: it needs a store reachable
 * without a session and opt-in via `DENOMINE_KEYRING_SMOKE=1`, so the normal
 * suite stays on the fakes. A unique account keeps concurrent or repeated runs
 * from colliding.
 */
Deno.test({
  name: "FfiKeyring round-trips a secret through the OS credential store",
  ignore: !headlessStore() || !smokeEnabled(),
  async fn() {
    const keyring = new FfiKeyring();
    const account = `https://denomine-mcp.test/${crypto.randomUUID()}`;
    const secret = `smoke-secret-${crypto.randomUUID()}`;

    await keyring.set(account, secret);
    try {
      expect(await keyring.get(account)).toBe(secret);
      expect(
        (await keyring.list()).includes(account),
        "list should include the stored account",
      ).toBe(true);
    } finally {
      await keyring.delete(account);
    }

    expect(await keyring.get(account)).toBe(undefined);
    expect(
      !(await keyring.list()).includes(account),
      "list should not include the deleted account",
    ).toBe(true);
  },
});
