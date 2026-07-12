import { assert, assertEquals } from "jsr:@std/assert@1.0.18";
import { Client } from "npm:@modelcontextprotocol/sdk@1.29.0/client/index.js";
import { InMemoryTransport } from "npm:@modelcontextprotocol/sdk@1.29.0/inMemory.js";
import { buildServer } from "./server.ts";
import { FakeIssuePort, FakeWikiPort } from "../redmine/fake.ts";
import { issuesTool } from "../tools/issues/mod.ts";
import { wikiTool } from "../tools/wiki/mod.ts";
import type { ToolModule } from "./tool.ts";
import type { Mode } from "../tools/mode.ts";

async function connectTools(tools: ToolModule[], mode: Mode): Promise<Client> {
  const server = buildServer(tools, mode);
  const [clientTransport, serverTransport] = InMemoryTransport
    .createLinkedPair();
  const client = new Client({ name: "test", version: "0" }, {
    capabilities: {},
  });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

async function connect(mode: Mode): Promise<Client> {
  const server = buildServer([issuesTool(new FakeIssuePort())], mode);
  const [clientTransport, serverTransport] = InMemoryTransport
    .createLinkedPair();
  const client = new Client({ name: "test", version: "0" }, {
    capabilities: {},
  });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

type CallResult = { content: { text: string }[]; isError?: boolean };

function textOf(result: CallResult): string {
  return result.content[0].text;
}

Deno.test("MCP server drives issue CRUD over an in-memory transport", async () => {
  const client = await connect("full");
  try {
    const created = await client.callTool({
      name: "redmine_issues",
      arguments: {
        action: "create",
        projectId: 1,
        trackerId: 1,
        statusId: 1,
        priorityId: 2,
        subject: "over mcp",
      },
    }) as CallResult;
    assert(created.isError !== true);

    const listed = await client.callTool({
      name: "redmine_issues",
      arguments: { action: "list" },
    }) as CallResult;
    const { issues } = JSON.parse(textOf(listed)) as {
      issues: { id: number }[];
    };
    assertEquals(issues.length, 1);
    const id = issues[0].id;

    const updated = await client.callTool({
      name: "redmine_issues",
      arguments: { action: "update", id, subject: "changed" },
    }) as CallResult;
    assert(updated.isError !== true);

    const shown = await client.callTool({
      name: "redmine_issues",
      arguments: { action: "show", id },
    }) as CallResult;
    const { issue } = JSON.parse(textOf(shown)) as {
      issue: { subject: string };
    };
    assertEquals(issue.subject, "changed");

    const deleted = await client.callTool({
      name: "redmine_issues",
      arguments: { action: "delete", id },
    }) as CallResult;
    assert(deleted.isError !== true);

    const gone = await client.callTool({
      name: "redmine_issues",
      arguments: { action: "show", id },
    }) as CallResult;
    assertEquals(gone.isError, true);
  } finally {
    await client.close();
  }
});

Deno.test("readonly mode advertises only read actions", async () => {
  const client = await connect("readonly");
  try {
    const { tools } = await client.listTools();
    const schema = tools[0].inputSchema as {
      properties: { action: { enum: string[] } };
    };
    assertEquals(schema.properties.action.enum, ["list", "show"]);

    const write = await client.callTool({
      name: "redmine_issues",
      arguments: {
        action: "create",
        projectId: 1,
        trackerId: 1,
        statusId: 1,
        priorityId: 2,
        subject: "denied",
      },
    }) as CallResult;
    assertEquals(write.isError, true);
  } finally {
    await client.close();
  }
});

Deno.test("server advertises every registered tool and dispatches wiki CRUD", async () => {
  const client = await connectTools(
    [issuesTool(new FakeIssuePort()), wikiTool(new FakeWikiPort())],
    "full",
  );
  try {
    const { tools } = await client.listTools();
    assertEquals(
      tools.map((tool: { name: string }) => tool.name).sort(),
      ["redmine_issues", "redmine_wiki_pages"],
    );

    const created = await client.callTool({
      name: "redmine_wiki_pages",
      arguments: { action: "create", projectId: 1, title: "Home", text: "hi" },
    }) as CallResult;
    assert(created.isError !== true);

    const shown = await client.callTool({
      name: "redmine_wiki_pages",
      arguments: { action: "show", projectId: 1, title: "Home" },
    }) as CallResult;
    const { wiki_page } = JSON.parse(textOf(shown)) as {
      wiki_page: { text: string };
    };
    assertEquals(wiki_page.text, "hi");

    const deleted = await client.callTool({
      name: "redmine_wiki_pages",
      arguments: { action: "delete", projectId: 1, title: "Home" },
    }) as CallResult;
    assert(deleted.isError !== true);
  } finally {
    await client.close();
  }
});
