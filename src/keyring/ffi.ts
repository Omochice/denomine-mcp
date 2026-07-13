import type { Keyring } from "./port.ts";

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

/** The dynamic-library extension for the current platform. */
function dylibExtension(): string {
  switch (Deno.build.os) {
    case "windows":
      return "dll";
    case "darwin":
      return "dylib";
    default:
      return "so";
  }
}

/**
 * Locate the built `cdylib`.
 *
 * This resolves the path next to the source tree, which is the dev/test case.
 * A `deno compile` binary embeds the dylib with `--include`; resolving the
 * path from the extracted temp directory of a compiled binary is a follow-up
 * (see ADR-0003).
 */
function dylibPath(): string {
  const name = `libkeyring_ffi.${dylibExtension()}`;
  return new URL(
    `../../ffi/target/release/${name}`,
    import.meta.url,
  ).pathname;
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
    this.#lib = Deno.dlopen(dylibPath(), SYMBOLS);
  }

  get(account: string): Promise<string | undefined> {
    const ptr = this.#lib.symbols.keyring_get(
      cString(SERVICE),
      cString(account),
    );
    if (ptr === null) {
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
    if (ptr === null) {
      return Promise.reject(new Error("keyring_list failed"));
    }
    const raw = new Deno.UnsafePointerView(ptr).getCString();
    this.#lib.symbols.keyring_string_free(ptr);
    return Promise.resolve(raw.split("\n").filter((account) => account !== ""));
  }
}
