/**
 * The credential store the CLI depends on, keyed by endpoint URL.
 *
 * The core depends only on this port; the real backend binds it to the OS
 * keyring over FFI, and a fake backs the unit tests (see ADR-0003, ADR-0007).
 * The service name (the application id) is fixed by the backend, so callers key
 * only by the endpoint account.
 */
export interface Keyring {
  /** Returns the stored secret for the account, or `undefined` if none. */
  get(account: string): Promise<string | undefined>;
  /** Stores (or replaces) the secret for the account. */
  set(account: string, secret: string): Promise<void>;
  /** Removes the stored secret for the account; a no-op if none exists. */
  delete(account: string): Promise<void>;
}
