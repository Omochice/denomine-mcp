import { expect } from "jsr:@std/expect@1.0.20";
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
    expect(response.isError).not.toBe(true);
  });

  await t.step("list returns the created relation", async () => {
    const response = await handleRelation(port, { action: "list", issueId: 1 });
    const { relations } = JSON.parse(textOf(response)) as {
      relations: { id: number; relationType: string }[];
    };
    expect(relations.length).toBe(1);
    expect(relations[0].relationType).toBe("blocks");
  });

  await t.step("show returns the relation by id", async () => {
    const response = await handleRelation(port, { action: "show", id: 1 });
    const { relation } = JSON.parse(textOf(response)) as {
      relation: { issueToId: number };
    };
    expect(relation.issueToId).toBe(2);
  });

  await t.step("delete removes the relation", async () => {
    const response = await handleRelation(port, { action: "delete", id: 1 });
    expect(response.isError).not.toBe(true);
    const shown = await handleRelation(port, { action: "show", id: 1 });
    expect(shown.isError).toBe(true);
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
  expect(response.isError).toBe(true);
});
