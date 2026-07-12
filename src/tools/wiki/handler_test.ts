import { assert, assertEquals } from "jsr:@std/assert@1.0.18";
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
    assert(response.isError !== true);
  });

  await t.step("list returns the created page", async () => {
    const response = await handleWiki(port, { action: "list", projectId: 1 });
    const { wiki_pages } = JSON.parse(textOf(response)) as {
      wiki_pages: { title: string }[];
    };
    assertEquals(wiki_pages.map((page) => page.title), ["Home"]);
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
    assertEquals(wiki_page.text, "first");
    assertEquals(wiki_page.version, 1);
  });

  await t.step("update bumps the version", async () => {
    const response = await handleWiki(port, {
      action: "update",
      projectId: 1,
      title: "Home",
      text: "second",
    });
    assert(response.isError !== true);
    const shown = await handleWiki(port, {
      action: "show",
      projectId: 1,
      title: "Home",
    });
    const { wiki_page } = JSON.parse(textOf(shown)) as {
      wiki_page: { text: string; version: number };
    };
    assertEquals(wiki_page.text, "second");
    assertEquals(wiki_page.version, 2);
  });

  await t.step("delete removes the page", async () => {
    const response = await handleWiki(port, {
      action: "delete",
      projectId: 1,
      title: "Home",
    });
    assert(response.isError !== true);
    const shown = await handleWiki(port, {
      action: "show",
      projectId: 1,
      title: "Home",
    });
    assertEquals(shown.isError, true);
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
  assertEquals(response.isError, true);
});
