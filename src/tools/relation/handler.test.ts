import { assert, assertEquals } from "jsr:@std/assert@1.0.18";
import { FakeRelationPort } from "../../redmine/fake.ts";
import { handleRelation } from "./handler.ts";

function textOf(response: { content: { text: string }[] }): string {
  return response.content[0].text;
}

Deno.test("relation handler runs a full create/read/delete cycle", async (t) => {
  const port = new FakeRelationPort();

  await t.step("create succeeds", async () => {
    const response = await handleRelation(port, {
      action: "create",
      issueId: 1,
      issueToId: 2,
      relationType: "blocks",
    });
    assert(response.isError !== true);
  });

  await t.step("list returns the created relation", async () => {
    const response = await handleRelation(port, { action: "list", issueId: 1 });
    const { relations } = JSON.parse(textOf(response)) as {
      relations: { id: number; relationType: string }[];
    };
    assertEquals(relations.length, 1);
    assertEquals(relations[0].relationType, "blocks");
  });

  await t.step("show returns the relation by id", async () => {
    const response = await handleRelation(port, { action: "show", id: 1 });
    const { relation } = JSON.parse(textOf(response)) as {
      relation: { issueToId: number };
    };
    assertEquals(relation.issueToId, 2);
  });

  await t.step("delete removes the relation", async () => {
    const response = await handleRelation(port, { action: "delete", id: 1 });
    assert(response.isError !== true);
    const shown = await handleRelation(port, { action: "show", id: 1 });
    assertEquals(shown.isError, true);
  });
});

Deno.test("relation handler rejects relating an issue to itself", async () => {
  const port = new FakeRelationPort();
  const response = await handleRelation(port, {
    action: "create",
    issueId: 1,
    issueToId: 1,
    relationType: "relates",
  });
  assertEquals(response.isError, true);
});
