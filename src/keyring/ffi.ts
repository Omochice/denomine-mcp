import type { Keyring } from "./port.ts";
import { fromRoot } from "../../root.ts";

/**
 * The application id under which every credential is stored. Fixed by the
 * backend (not taken from the caller) so accounts are namespaced solely by the
 * endpoint URL (see ADR-0003, ADR-0004).
 */
const SERVICE = "denomine-mcp";

const SYMBOLS = {
  keyring_set: { parameters: ["buffer", "buffer", "buffer"], result: "i32" },
  keyring_get: { parameters: ["buffer", "buffer"], result: "pointer" },
  keyring_delete: { parameters: ["buffer", "buffer"], result: "i32" },
  keyring_list: { parameters: ["buffer"], result: "pointer" },
  keyring_string_free: { parameters: ["pointer"], result: "void" },
} as const satisfies Deno.ForeignLibraryInterface;

/**
 * The `cdylib` file name Cargo emits for `os`, the current platform by default.
 *
 * The extension is not the only thing that varies: the MSVC toolchain emits a
 * bare `keyring_ffi.dll`, while Unix toolchains prefix the crate name with
 * `lib`. Naming each platform's file in full keeps that difference visible
 * rather than hiding it in a prefix that only happens to be right twice.
 */
export function dylibName(os: typeof Deno.build.os = Deno.build.os): string {
  switch (os) {
    case "windows":
      return "keyring_ffi.dll";
    case "darwin":
      return "libkeyring_ffi.dylib";
    default:
      return "libkeyring_ffi.so";
  }
}

/** Encode a string as a NUL-terminated C string buffer. */
function cString(value: string): Uint8Array {
  return new TextEncoder().encode(`${value}\0`);
}

/**
 * {@link Keyring} backed by the OS keychain through the Rust `keyring` crate
 * over Deno FFI (see ADR-0003). The `cdylib` is opened once per instance.
 */
export class FfiKeyring implements Keyring {
  readonly #lib: Deno.DynamicLibrary<typeof SYMBOLS>;

  constructor() {
    // The URL is passed as-is rather than through `pathname`, which on Windows
    // yields a leading-slash path (`/C:/...`) that cannot be opened.
    this.#lib = Deno.dlopen(
      fromRoot(`ffi/target/release/${dylibName()}`),
      SYMBOLS,
    );
  }

  get(account: string): Promise<string | undefined> {
    const ptr = this.#lib.symbols.keyring_get(
      cString(SERVICE),
      cString(account),
    );
    if (ptr == null) {
      return Promise.resolve(undefined);
    }
    const secret = new Deno.UnsafePointerView(ptr).getCString();
    this.#lib.symbols.keyring_string_free(ptr);
    return Promise.resolve(secret);
  }

  set(account: string, secret: string): Promise<void> {
    const code = this.#lib.symbols.keyring_set(
      cString(SERVICE),
      cString(account),
      cString(secret),
    );
    if (code < 0) {
      return Promise.reject(
        new Error(`keyring_set failed for ${account} (code ${code})`),
      );
    }
    return Promise.resolve();
  }

  delete(account: string): Promise<void> {
    const code = this.#lib.symbols.keyring_delete(
      cString(SERVICE),
      cString(account),
    );
    if (code < 0) {
      return Promise.reject(
        new Error(`keyring_delete failed for ${account} (code ${code})`),
      );
    }
    return Promise.resolve();
  }

  list(): Promise<string[]> {
    const ptr = this.#lib.symbols.keyring_list(cString(SERVICE));
    if (ptr == null) {
      return Promise.reject(new Error("keyring_list failed"));
    }
    const raw = new Deno.UnsafePointerView(ptr).getCString();
    this.#lib.symbols.keyring_string_free(ptr);
    return Promise.resolve(raw.split("\n").filter((account) => account !== ""));
  }
}
