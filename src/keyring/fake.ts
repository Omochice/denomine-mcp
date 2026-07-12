import type { Keyring } from "./port.ts";

/**
 * In-memory {@link Keyring} for tests, standing in for the OS keyring so the CLI
 * wiring can be exercised without a keychain (ADR-0007). An optional seed lets a
 * test start with credentials already stored.
 */
export class FakeKeyring implements Keyring {
  readonly #store: Map<string, string>;

  constructor(seed?: Record<string, string>) {
    this.#store = new Map(Object.entries(seed ?? {}));
  }

  get(account: string): Promise<string | undefined> {
    return Promise.resolve(this.#store.get(account));
  }

  set(account: string, secret: string): Promise<void> {
    this.#store.set(account, secret);
    return Promise.resolve();
  }

  delete(account: string): Promise<void> {
    this.#store.delete(account);
    return Promise.resolve();
  }
}
