import { expect } from "jsr:@std/expect@1.0.20";
import { Client } from "npm:@modelcontextprotocol/sdk@1.30.0/client/index.js";
import { InMemoryTransport } from "npm:@modelcontextprotocol/sdk@1.30.0/inMemory.js";
import { buildServer } from "./server.ts";
import {
  FakeEnumerationPort,
  FakeIssuePort,
  FakeRelationPort,
  FakeSearchPort,
  FakeTimeEntryPort,
  FakeVersionPort,
  FakeWikiPort,
} from "../redmine/fake.ts";
import { issuesTool } from "../tools/issues/mod.ts";
import { wikiTool } from "../tools/wiki/mod.ts";
import { versionTool } from "../tools/version/mod.ts";
import { relationTool } from "../tools/relation/mod.ts";
import { searchTool } from "../tools/search/mod.ts";
import { timeEntryTool } from "../tools/time_entry/mod.ts";
import { enumerationTool } from "../tools/enumeration/mod.ts";
import type { ToolModule } from "./tool.ts";
import type { Mode } from "../tools/mode.ts";
import { VERSION } from "../version.ts";

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

Deno.test("MCP server reports the released version to the client", async () => {
  const client = await connect("full");
  try {
    expect(client.getServerVersion()?.version).toBe(VERSION);
  } finally {
    await client.close();
  }
});

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
    expect(created.isError).not.toBe(true);

    const listed = await client.callTool({
      name: "redmine_issues",
      arguments: { action: "list" },
    }) as CallResult;
    const { issues } = JSON.parse(textOf(listed)) as {
      issues: { id: number }[];
    };
    expect(issues.length).toBe(1);
    const id = issues[0].id;

    const updated = await client.callTool({
      name: "redmine_issues",
      arguments: { action: "update", id, subject: "changed" },
    }) as CallResult;
    expect(updated.isError).not.toBe(true);

    const shown = await client.callTool({
      name: "redmine_issues",
      arguments: { action: "show", id },
    }) as CallResult;
    const { issue } = JSON.parse(textOf(shown)) as {
      issue: { subject: string };
    };
    expect(issue.subject).toBe("changed");

    const deleted = await client.callTool({
      name: "redmine_issues",
      arguments: { action: "delete", id },
    }) as CallResult;
    expect(deleted.isError).not.toBe(true);

    const gone = await client.callTool({
      name: "redmine_issues",
      arguments: { action: "show", id },
    }) as CallResult;
    expect(gone.isError).toBe(true);
  } finally {
    await client.close();
  }
});

Deno.test("MCP server advertises and dispatches the read-only search tool", async () => {
  const port = new FakeSearchPort([
    { id: 1, title: "login fails", type: "issue", url: "/issues/1" },
  ]);
  const client = await connectTools([searchTool(port)], "readonly");
  try {
    const { tools } = await client.listTools();
    const search = (tools as {
      name: string;
      inputSchema: { properties: { action: { enum: string[] } } };
    }[]).find((tool) => tool.name === "redmine_search");
    expect(search, "search tool should be advertised").toBeDefined();
    expect(search!.inputSchema.properties.action.enum).toStrictEqual([
      "search",
    ]);

    const result = await client.callTool({
      name: "redmine_search",
      arguments: { action: "search", q: "login" },
    }) as CallResult;
    expect(result.isError).not.toBe(true);
    const hits = JSON.parse(textOf(result)) as { id: number }[];
    expect(hits.map((hit) => hit.id)).toStrictEqual([1]);
  } finally {
    await client.close();
  }
});

Deno.test("readonly mode advertises only read actions for every CRUD tool", async () => {
  const client = await connectTools(
    [
      issuesTool(new FakeIssuePort()),
      wikiTool(new FakeWikiPort()),
      versionTool(new FakeVersionPort()),
      relationTool(new FakeRelationPort()),
      timeEntryTool(new FakeTimeEntryPort()),
    ],
    "readonly",
  );
  try {
    const { tools } = await client.listTools();
    for (
      const tool of tools as {
        description: string;
        inputSchema: { properties: { action: { enum: string[] } } };
      }[]
    ) {
      expect(tool.inputSchema.properties.action.enum).toStrictEqual([
        "list",
        "show",
      ]);
      expect(
        !/create|update|delete/i.test(tool.description),
        `readonly description should not mention writes: ${tool.description}`,
      ).toBe(true);
    }

    for (
      const name of [
        "redmine_issues",
        "redmine_wiki_pages",
        "redmine_versions",
        "redmine_issue_relations",
        "redmine_time_entries",
      ]
    ) {
      const write = await client.callTool({
        name,
        arguments: { action: "create" },
      }) as CallResult;
      expect(write.isError, `${name} create should be rejected`).toBe(true);
    }
  } finally {
    await client.close();
  }
});

Deno.test("readonly mode leaves the enumeration tool intact", async () => {
  const client = await connectTools(
    [enumerationTool(new FakeEnumerationPort())],
    "readonly",
  );
  try {
    const { tools } = await client.listTools();
    const enumerations = (tools as {
      name: string;
      description: string;
      inputSchema: { properties: { action: { enum: string[] } } };
    }[]).find((tool) => tool.name === "redmine_enumerations");
    expect(enumerations, "enumeration tool should be advertised").toBeDefined();
    expect(enumerations!.inputSchema.properties.action.enum).toStrictEqual([
      "listTimeEntryActivities",
      "listIssuePriorities",
      "listDocumentCategories",
    ]);
    expect(
      !/create|update|delete/i.test(enumerations!.description),
      `enumeration description should not mention writes: ${
        enumerations!.description
      }`,
    ).toBe(true);

    const listed = await client.callTool({
      name: "redmine_enumerations",
      arguments: { action: "listTimeEntryActivities" },
    }) as CallResult;
    expect(listed.isError).not.toBe(true);
    const activities = JSON.parse(textOf(listed)) as { name: string }[];
    expect(activities.map((activity) => activity.name)).toStrictEqual([
      "Design",
      "Development",
    ]);
  } finally {
    await client.close();
  }
});

Deno.test("server advertises every registered tool and dispatches their CRUD", async () => {
  const client = await connectTools(
    [
      issuesTool(new FakeIssuePort()),
      wikiTool(new FakeWikiPort()),
      versionTool(new FakeVersionPort()),
      relationTool(new FakeRelationPort()),
      timeEntryTool(new FakeTimeEntryPort()),
      enumerationTool(new FakeEnumerationPort()),
    ],
    "full",
  );
  try {
    const { tools } = await client.listTools();
    expect(tools.map((tool: { name: string }) => tool.name).sort())
      .toStrictEqual([
        "redmine_enumerations",
        "redmine_issue_relations",
        "redmine_issues",
        "redmine_time_entries",
        "redmine_versions",
        "redmine_wiki_pages",
      ]);
    const writable = (tools as { name: string; description: string }[]).filter(
      (tool) => tool.name !== "redmine_enumerations",
    );
    for (const tool of writable) {
      expect(
        /create.*delete/i.test(tool.description),
        `full-mode description should mention writes: ${tool.description}`,
      ).toBe(true);
    }

    const wikiCreated = await client.callTool({
      name: "redmine_wiki_pages",
      arguments: { action: "create", projectId: 1, title: "Home", text: "hi" },
    }) as CallResult;
    expect(wikiCreated.isError).not.toBe(true);

    const wikiShown = await client.callTool({
      name: "redmine_wiki_pages",
      arguments: { action: "show", projectId: 1, title: "Home" },
    }) as CallResult;
    const { wiki_page } = JSON.parse(textOf(wikiShown)) as {
      wiki_page: { text: string };
    };
    expect(wiki_page.text).toBe("hi");

    const versionCreated = await client.callTool({
      name: "redmine_versions",
      arguments: { action: "create", projectId: 1, name: "v1.0" },
    }) as CallResult;
    expect(versionCreated.isError).not.toBe(true);

    const versionShown = await client.callTool({
      name: "redmine_versions",
      arguments: { action: "show", id: 1 },
    }) as CallResult;
    const { version } = JSON.parse(textOf(versionShown)) as {
      version: { name: string };
    };
    expect(version.name).toBe("v1.0");

    const versionDeleted = await client.callTool({
      name: "redmine_versions",
      arguments: { action: "delete", id: 1 },
    }) as CallResult;
    expect(versionDeleted.isError).not.toBe(true);

    const entryCreated = await client.callTool({
      name: "redmine_time_entries",
      arguments: { action: "create", projectId: 1, hours: 3 },
    }) as CallResult;
    expect(entryCreated.isError).not.toBe(true);

    const entryShown = await client.callTool({
      name: "redmine_time_entries",
      arguments: { action: "show", id: 1 },
    }) as CallResult;
    const { timeEntry } = JSON.parse(textOf(entryShown)) as {
      timeEntry: { hours: number };
    };
    expect(timeEntry.hours).toBe(3);

    const entryDeleted = await client.callTool({
      name: "redmine_time_entries",
      arguments: { action: "delete", id: 1 },
    }) as CallResult;
    expect(entryDeleted.isError).not.toBe(true);

    const priorities = await client.callTool({
      name: "redmine_enumerations",
      arguments: { action: "listIssuePriorities" },
    }) as CallResult;
    expect(priorities.isError).not.toBe(true);
  } finally {
    await client.close();
  }
});
