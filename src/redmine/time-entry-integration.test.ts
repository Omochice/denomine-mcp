import { expect } from "jsr:@std/expect@1.0.20";
import { Result } from "@praha/byethrow";
import { EnumerationClient } from "./enumeration-client.ts";
import { TimeEntryClient } from "./time-entry-client.ts";

function env(name: string): string | undefined {
  try {
    return Deno.env.get(name);
  } catch {
    return undefined;
  }
}

const endpoint = env("DENOMINE_TEST_ENDPOINT");
const apiKey = env("DENOMINE_TEST_API_KEY");
const projectId = Number(env("DENOMINE_TEST_PROJECT_ID") ?? "1");

const spentOn = "2026-01-15";

/** Exercises the real time entry client against a live Redmine (doc/verification.md). */
Deno.test({
  name: "TimeEntryClient runs time entry CRUD against a live Redmine",
  ignore: endpoint === undefined || apiKey === undefined,
  sanitizeResources: false,
  fn: async (t) => {
    const context = { endpoint: endpoint!, apiKey: apiKey! };
    const client = new TimeEntryClient(context);
    const comments = `denomine-mcp ${Date.now()}`;
    let activityId = 0;
    let id = 0;

    await t.step("an activity id is discoverable", async () => {
      const result = await new EnumerationClient(context)
        .listTimeEntryActivities();
      expect(Result.isSuccess(result), JSON.stringify(result)).toBe(true);
      const activities = Result.unwrap(result) as {
        id: number;
        active: boolean;
      }[];
      // Redmine answers 422 for an inactive activity.
      const activity = activities.find((candidate) => candidate.active);
      expect(activity, "no active time entry activity is configured")
        .toBeDefined();
      activityId = activity!.id;
    });

    await t.step("create", async () => {
      const result = await client.create({
        projectId,
        hours: 1.25,
        activityId,
        spentOn,
        comments,
      });
      expect(Result.isSuccess(result), JSON.stringify(result)).toBe(true);
    });

    await t.step("list finds the created entry", async () => {
      const result = await client.list({
        projectId,
        from: spentOn,
        to: spentOn,
      });
      expect(Result.isSuccess(result)).toBe(true);
      const entries = Result.unwrap(result) as {
        id: number;
        comments?: string;
      }[];
      const found = entries.find((entry) => entry.comments === comments);
      expect(found, "created time entry not found in list").toBeDefined();
      id = found!.id;
    });

    await t.step("show returns the entry", async () => {
      const result = await client.show(id);
      expect(Result.isSuccess(result)).toBe(true);
      expect((Result.unwrap(result) as { hours: number }).hours).toBe(1.25);
    });

    await t.step("update changes the hours", async () => {
      const updated = await client.update(id, { hours: 2.5 });
      expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);
      const shown = await client.show(id);
      expect(Result.isSuccess(shown)).toBe(true);
      expect((Result.unwrap(shown) as { hours: number }).hours).toBe(2.5);
    });

    await t.step("delete removes the entry", async () => {
      const deleted = await client.delete(id);
      expect(Result.isSuccess(deleted), JSON.stringify(deleted)).toBe(true);
      const shown = await client.show(id);
      expect(Result.isFailure(shown), "time entry should be gone after delete")
        .toBe(true);
    });
  },
});
