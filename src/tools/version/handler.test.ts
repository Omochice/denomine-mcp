import { expect } from "jsr:@std/expect@1.0.20";
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
    expect(response.isError).not.toBe(true);
  });

  await t.step("list returns the created version", async () => {
    const response = await handleVersion(port, {
      action: "list",
      projectId: 1,
    });
    const { versions } = JSON.parse(textOf(response)) as {
      versions: { id: number; name: string }[];
    };
    expect(versions.map((version) => version.name)).toStrictEqual(["v1.0"]);
  });

  await t.step("show returns the version by id", async () => {
    const response = await handleVersion(port, { action: "show", id: 1 });
    const { version } = JSON.parse(textOf(response)) as {
      version: { name: string };
    };
    expect(version.name).toBe("v1.0");
  });

  await t.step("update changes the status", async () => {
    const response = await handleVersion(port, {
      action: "update",
      id: 1,
      status: "closed",
    });
    expect(response.isError).not.toBe(true);
    const shown = await handleVersion(port, { action: "show", id: 1 });
    const { version } = JSON.parse(textOf(shown)) as {
      version: { status: string };
    };
    expect(version.status).toBe("closed");
  });

  await t.step("delete removes the version", async () => {
    const response = await handleVersion(port, { action: "delete", id: 1 });
    expect(response.isError).not.toBe(true);
    const shown = await handleVersion(port, { action: "show", id: 1 });
    expect(shown.isError).toBe(true);
  });
});

Deno.test("version handler surfaces a validation failure as isError", async () => {
  const port = new FakeVersionPort();
  const response = await handleVersion(port, {
    action: "create",
    projectId: 1,
    name: "   ",
  });
  expect(response.isError).toBe(true);
});
