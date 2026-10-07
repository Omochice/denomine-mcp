import * as v from "@valibot/valibot";

/** Argument schema for the numeric id of a Redmine record. */
export const recordId = v.pipe(v.number(), v.integer(), v.minValue(1));
