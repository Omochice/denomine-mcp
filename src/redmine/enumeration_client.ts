import { Redmine } from "@omochice/redmine";
import { Result } from "@praha/byethrow";
import { toRedmineError } from "./error.ts";
import type { EnumerationPort, RedmineContext, RedmineResult } from "./port.ts";

/** Real {@link EnumerationPort} backed by `@omochice/redmine`. */
export class EnumerationClient implements EnumerationPort {
  readonly #redmine: Redmine;

  constructor(context: RedmineContext) {
    this.#redmine = new Redmine(context);
  }

  listTimeEntryActivities(): Promise<RedmineResult<unknown>> {
    return Result.try({
      try: () =>
        Array.fromAsync(this.#redmine.enumeration.listTimeEntryActivities()),
      catch: toRedmineError,
    });
  }

  listIssuePriorities(): Promise<RedmineResult<unknown>> {
    return Result.try({
      try: () =>
        Array.fromAsync(this.#redmine.enumeration.listIssuePriorities()),
      catch: toRedmineError,
    });
  }

  listDocumentCategories(): Promise<RedmineResult<unknown>> {
    return Result.try({
      try: () =>
        Array.fromAsync(this.#redmine.enumeration.listDocumentCategories()),
      catch: toRedmineError,
    });
  }
}
