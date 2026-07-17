import { assert, assertEquals } from "jsr:@std/assert@1.0.18";
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
      assert(created.ok, JSON.stringify(created));
      const listed = await issues.list({ projectId });
      assert(listed.ok);
      const found = (listed.value as { id: number; subject: string }[]).find(
        (issue) => issue.subject === subject,
      );
      assert(found !== undefined, `created issue ${subject} not found`);
      return found.id;
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
        assert(result.ok, JSON.stringify(result));
      });

      await t.step("list finds the relation", async () => {
        const result = await relations.list(fromId);
        assert(result.ok);
        const found = (result.value as { id: number; issueToId: number }[])
          .find((relation) => relation.issueToId === toId);
        assert(found !== undefined, "created relation not found in list");
        relationId = found.id;
      });

      await t.step("show returns the relation", async () => {
        const result = await relations.show(relationId);
        assert(result.ok);
        assertEquals((result.value as { id: number }).id, relationId);
      });

      await t.step("delete removes the relation", async () => {
        const deleted = await relations.delete(relationId);
        assert(deleted.ok, JSON.stringify(deleted));
        const listed = await relations.list(fromId);
        assert(listed.ok);
        assertEquals((listed.value as unknown[]).length, 0);
      });
    } finally {
      await issues.delete(fromId);
      await issues.delete(toId);
    }
  },
});
