/**
 * Marks a subcommand action as an unfilled stub.
 *
 * Throwing keeps the stub from exiting with a success status, so a not-yet-wired
 * subcommand cannot be mistaken for a working one during incremental build-out.
 *
 * @param command The subcommand name, used in the error message.
 */
export function notImplemented(command: string): never {
  throw new Error(`${command}: not yet implemented`);
}
