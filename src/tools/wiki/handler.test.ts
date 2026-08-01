import { expect } from "jsr:@std/expect@1.0.20";
import { FakeWikiPort } from "../../redmine/fake.ts";
import { handleWiki } from "./handler.ts";

function textOf(response: { content: { text: string }[] }): string {
  return response.content[0].text;
}

Deno.test("wiki handler runs a full CRUD cycle against the port", async (t) => {
  const port = new FakeWikiPort();

  await t.step("create succeeds", async () => {
    const response = await handleWiki(port, {
      action: "create",
      projectId: 1,
      title: "Home",
      text: "first",
    });
    expect(response.isError).not.toBe(true);
  });

  await t.step("list returns the created page", async () => {
    const response = await handleWiki(port, { action: "list", projectId: 1 });
    const { wiki_pages } = JSON.parse(textOf(response)) as {
      wiki_pages: { title: string }[];
    };
    expect(wiki_pages.map((page) => page.title)).toStrictEqual(["Home"]);
  });

  await t.step("show returns the page by title", async () => {
    const response = await handleWiki(port, {
      action: "show",
      projectId: 1,
      title: "Home",
    });
    const { wiki_page } = JSON.parse(textOf(response)) as {
      wiki_page: { text: string; version: number };
    };
    expect(wiki_page.text).toBe("first");
    expect(wiki_page.version).toBe(1);
  });

  await t.step("update bumps the version", async () => {
    const response = await handleWiki(port, {
      action: "update",
      projectId: 1,
      title: "Home",
      text: "second",
    });
    expect(response.isError).not.toBe(true);
    const shown = await handleWiki(port, {
      action: "show",
      projectId: 1,
      title: "Home",
    });
    const { wiki_page } = JSON.parse(textOf(shown)) as {
      wiki_page: { text: string; version: number };
    };
    expect(wiki_page.text).toBe("second");
    expect(wiki_page.version).toBe(2);
  });

  await t.step("delete removes the page", async () => {
    const response = await handleWiki(port, {
      action: "delete",
      projectId: 1,
      title: "Home",
    });
    expect(response.isError).not.toBe(true);
    const shown = await handleWiki(port, {
      action: "show",
      projectId: 1,
      title: "Home",
    });
    expect(shown.isError).toBe(true);
  });
});

Deno.test("wiki handler surfaces a validation failure as isError", async () => {
  const port = new FakeWikiPort();
  const response = await handleWiki(port, {
    action: "create",
    projectId: 1,
    title: "   ",
    text: "body",
  });
  expect(response.isError).toBe(true);
});
