import type { Keyring } from "./port.ts";
import { FfiKeyring } from "./ffi.ts";

/**
 * Composition entrypoint for the keyring boundary: returns the real OS-keyring
 * backend the CLI depends on (see ADR-0003, ADR-0007). Tests substitute
 * `FakeKeyring` directly rather than calling this.
 */
export function openKeyring(): Keyring {
  return new FfiKeyring();
}
