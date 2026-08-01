import { expect } from "jsr:@std/expect@1.0.20";
import { Result } from "@praha/byethrow";
import { RedmineClient } from "./client.ts";
import { RelationClient } from "./relation_client.ts";

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

/**
 * Exercises the real `@omochice/redmine`-backed relation client end to end
 * against a live Redmine (see doc/verification.md). Skipped unless the endpoint
 * and API key are supplied. Two issues are created to relate, then cleaned up.
 */
Deno.test({
  name:
    "RelationClient runs relation create/read/delete against a live Redmine",
  ignore: endpoint === undefined || apiKey === undefined,
  sanitizeResources: false,
  fn: async (t) => {
    const context = { endpoint: endpoint!, apiKey: apiKey! };
    const issues = new RedmineClient(context);
    const relations = new RelationClient(context);

    const createIssue = async (subject: string): Promise<number> => {
      const created = await issues.create({
        projectId,
        trackerId: 1,
        statusId: 1,
        priorityId: 2,
        subject,
      });
      expect(Result.isSuccess(created), JSON.stringify(created)).toBe(true);
      const listed = await issues.list({ projectId });
      expect(Result.isSuccess(listed)).toBe(true);
      const found = (Result.unwrap(listed) as { id: number; subject: string }[])
        .find(
          (issue) => issue.subject === subject,
        );
      expect(found, `created issue ${subject} not found`).toBeDefined();
      return found!.id;
    };

    const stamp = Date.now();
    const fromId = await createIssue(`relation from ${stamp}`);
    const toId = await createIssue(`relation to ${stamp}`);
    let relationId = 0;

    try {
      await t.step("create", async () => {
        const result = await relations.create(fromId, {
          issueToId: toId,
          relationType: "relates",
        });
        expect(Result.isSuccess(result), JSON.stringify(result)).toBe(true);
      });

      await t.step("list finds the relation", async () => {
        const result = await relations.list(fromId);
        expect(Result.isSuccess(result)).toBe(true);
        const found =
          (Result.unwrap(result) as { id: number; issueToId: number }[])
            .find((relation) => relation.issueToId === toId);
        expect(found, "created relation not found in list").toBeDefined();
        relationId = found!.id;
      });

      await t.step("show returns the relation", async () => {
        const result = await relations.show(relationId);
        expect(Result.isSuccess(result)).toBe(true);
        expect((Result.unwrap(result) as { id: number }).id).toBe(relationId);
      });

      await t.step("delete removes the relation", async () => {
        const deleted = await relations.delete(relationId);
        expect(Result.isSuccess(deleted), JSON.stringify(deleted)).toBe(true);
        const listed = await relations.list(fromId);
        expect(Result.isSuccess(listed)).toBe(true);
        expect((Result.unwrap(listed) as unknown[]).length).toBe(0);
      });
    } finally {
      await issues.delete(fromId);
      await issues.delete(toId);
    }
  },
});
