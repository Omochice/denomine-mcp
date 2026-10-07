import * as v from "@valibot/valibot";

const showInput = v.strictObject({ action: v.literal("show") });

/** The server-info-tool argument shape. It has the single action `show`. */
export type ServerInfoToolInput = v.InferOutput<typeof showInput>;

/**
 * Builds the server-info-tool argument schema. It reports on the server rather
 * than Redmine, so it is the same in both modes.
 */
export function serverInfoInputSchema() {
  return v.variant("action", [showInput]);
}
