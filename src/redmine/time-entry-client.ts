import { Redmine } from "@omochice/redmine";
import { Result } from "@praha/byethrow";
import { toRedmineError } from "./error.ts";
import type {
  IsoDate,
  RedmineContext,
  RedmineResult,
  TimeEntryCreate,
  TimeEntryListQuery,
  TimeEntryPort,
  TimeEntryUpdate,
} from "./port.ts";

// `@omochice/redmine` takes `Date` and serializes it back to `YYYY-MM-DD` in UTC.
function withDates<T extends Record<string, unknown>, K extends keyof T>(
  attrs: T,
  keys: readonly K[],
): Omit<T, K> & Partial<Record<K, Date>> {
  const converted = { ...attrs } as Record<string, unknown>;
  for (const key of keys) {
    const value = attrs[key] as IsoDate | undefined;
    if (value !== undefined) {
      converted[key as string] = new Date(value);
    }
  }
  return converted as Omit<T, K> & Partial<Record<K, Date>>;
}

/** Real {@link TimeEntryPort} backed by `@omochice/redmine`. */
export class TimeEntryClient implements TimeEntryPort {
  readonly #redmine: Redmine;

  constructor(context: RedmineContext) {
    this.#redmine = new Redmine(context);
  }

  list(query: TimeEntryListQuery): Promise<RedmineResult<unknown>> {
    return Result.try({
      try: () =>
        Array.fromAsync(
          this.#redmine.timeEntry.list(
            withDates(query, ["spentOn", "from", "to"]),
          ),
        ),
      catch: toRedmineError,
    });
  }

  show(id: number): Promise<RedmineResult<unknown>> {
    return Result.try({
      try: () => this.#redmine.timeEntry.show(id),
      catch: toRedmineError,
    });
  }

  create(attrs: TimeEntryCreate): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        await this.#redmine.timeEntry.create(withDates(attrs, ["spentOn"]));
        return null;
      },
      catch: toRedmineError,
    });
  }

  update(id: number, attrs: TimeEntryUpdate): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        await this.#redmine.timeEntry.update(id, withDates(attrs, ["spentOn"]));
        return null;
      },
      catch: toRedmineError,
    });
  }

  delete(id: number): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        await this.#redmine.timeEntry.delete(id);
        return null;
      },
      catch: toRedmineError,
    });
  }
}
