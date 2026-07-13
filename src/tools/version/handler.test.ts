import { assert, assertEquals } from "jsr:@std/assert@1.0.18";
import { FakeVersionPort } from "../../redmine/fake.ts";
import { handleVersion } from "./handler.ts";

function textOf(response: { content: { text: string }[] }): string {
  return response.content[0].text;
}

Deno.test("version handler runs a full CRUD cycle against the port", async (t) => {
  const port = new FakeVersionPort();

  await t.step("create succeeds", async () => {
    const response = await handleVersion(port, {
      action: "create",
      projectId: 1,
      name: "v1.0",
      dueDate: "2026-08-01",
    });
    assert(response.isError !== true);
  });

  await t.step("list returns the created version", async () => {
    const response = await handleVersion(port, {
      action: "list",
      projectId: 1,
    });
    const { versions } = JSON.parse(textOf(response)) as {
      versions: { id: number; name: string }[];
    };
    assertEquals(versions.map((version) => version.name), ["v1.0"]);
  });

  await t.step("show returns the version by id", async () => {
    const response = await handleVersion(port, { action: "show", id: 1 });
    const { version } = JSON.parse(textOf(response)) as {
      version: { name: string };
    };
    assertEquals(version.name, "v1.0");
  });

  await t.step("update changes the status", async () => {
    const response = await handleVersion(port, {
      action: "update",
      id: 1,
      status: "closed",
    });
    assert(response.isError !== true);
    const shown = await handleVersion(port, { action: "show", id: 1 });
    const { version } = JSON.parse(textOf(shown)) as {
      version: { status: string };
    };
    assertEquals(version.status, "closed");
  });

  await t.step("delete removes the version", async () => {
    const response = await handleVersion(port, { action: "delete", id: 1 });
    assert(response.isError !== true);
    const shown = await handleVersion(port, { action: "show", id: 1 });
    assertEquals(shown.isError, true);
  });
});

Deno.test("version handler surfaces a validation failure as isError", async () => {
  const port = new FakeVersionPort();
  const response = await handleVersion(port, {
    action: "create",
    projectId: 1,
    name: "   ",
  });
  assertEquals(response.isError, true);
});
