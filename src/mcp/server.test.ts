import { expect } from "@std/expect";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "./server.ts";
import {
  FakeAttachmentPort,
  FakeEnumerationPort,
  FakeIssuePort,
  FakeRelationPort,
  FakeSearchPort,
  FakeTimeEntryPort,
  FakeVersionPort,
  FakeWikiPort,
} from "../redmine/fake.ts";
import { FakeFilePort } from "../file/fake.ts";
import { attachmentTool } from "../tools/attachment/mod.ts";
import { defaultMaxSize } from "../tools/attachment/schema.ts";
import { issuesTool } from "../tools/issues/mod.ts";
import { wikiTool } from "../tools/wiki/mod.ts";
import { versionTool } from "../tools/version/mod.ts";
import { relationTool } from "../tools/relation/mod.ts";
import { searchTool } from "../tools/search/mod.ts";
import { timeEntryTool } from "../tools/time-entry/mod.ts";
import { enumerationTool } from "../tools/enumeration/mod.ts";
import type { ToolModule } from "./tool.ts";
import type { Mode } from "../tools/mode.ts";
import { VERSION } from "../version.ts";
import { registeredTools } from "../cli/run.ts";

async function connectTools(
  tools: ToolModule[],
  mode: Mode,
): Promise<Client & AsyncDisposable> {
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
  return Object.assign(client, {
    [Symbol.asyncDispose]: () => client.close(),
  });
}

function connect(mode: Mode): Promise<Client & AsyncDisposable> {
  return connectTools([issuesTool(new FakeIssuePort())], mode);
}

type CallResult = { content: { text: string }[]; isError?: boolean };

function textOf(result: CallResult): string {
  return result.content[0].text;
}

Deno.test("MCP server reports the released version to the client", async () => {
  await using client = await connect("full");
  expect(client.getServerVersion()?.version).toBe(VERSION);
});

Deno.test("MCP server drives issue CRUD over an in-memory transport", async () => {
  await using client = await connect("full");
  const created = await client.callTool({
    name: "redmine_issues",
    arguments: {
      create: {
        projectId: 1,
        trackerId: 1,
        statusId: 1,
        priorityId: 2,
        subject: "over mcp",
      },
    },
  }) as CallResult;
  expect(created.isError).not.toBe(true);

  const listed = await client.callTool({
    name: "redmine_issues",
    arguments: { list: {} },
  }) as CallResult;
  const { issues } = JSON.parse(textOf(listed)) as {
    issues: { id: number }[];
  };
  expect(issues.length).toBe(1);
  const id = issues[0].id;

  const updated = await client.callTool({
    name: "redmine_issues",
    arguments: { update: { id, subject: "changed" } },
  }) as CallResult;
  expect(updated.isError).not.toBe(true);

  const shown = await client.callTool({
    name: "redmine_issues",
    arguments: { show: { id } },
  }) as CallResult;
  const { issue } = JSON.parse(textOf(shown)) as {
    issue: { subject: string };
  };
  expect(issue.subject).toBe("changed");

  const deleted = await client.callTool({
    name: "redmine_issues",
    arguments: { delete: { id } },
  }) as CallResult;
  expect(deleted.isError).not.toBe(true);

  const gone = await client.callTool({
    name: "redmine_issues",
    arguments: { show: { id } },
  }) as CallResult;
  expect(gone.isError).toBe(true);
});

Deno.test("MCP server advertises and dispatches the read-only search tool", async () => {
  const port = new FakeSearchPort([
    { id: 1, title: "login fails", type: "issue", url: "/issues/1" },
  ]);
  await using client = await connectTools([searchTool(port)], "readonly");
  const { tools } = await client.listTools();
  const search = (tools as {
    name: string;
    inputSchema: { properties: Record<string, unknown> };
  }[]).find((tool) => tool.name === "redmine_search");
  expect(search, "search tool should be advertised").toBeDefined();
  expect(Object.keys(search!.inputSchema.properties)).toStrictEqual([
    "search",
  ]);

  const result = await client.callTool({
    name: "redmine_search",
    arguments: { search: { q: "login" } },
  }) as CallResult;
  expect(result.isError).not.toBe(true);
  const hits = JSON.parse(textOf(result)) as { id: number }[];
  expect(hits.map((hit) => hit.id)).toStrictEqual([1]);
});

Deno.test("readonly mode advertises only read actions for every CRUD tool", async () => {
  await using client = await connectTools(
    [
      issuesTool(new FakeIssuePort()),
      wikiTool(new FakeWikiPort()),
      versionTool(new FakeVersionPort()),
      relationTool(new FakeRelationPort()),
      timeEntryTool(new FakeTimeEntryPort()),
    ],
    "readonly",
  );
  const { tools } = await client.listTools();
  for (
    const tool of tools as {
      description: string;
      inputSchema: { properties: Record<string, unknown> };
    }[]
  ) {
    expect(Object.keys(tool.inputSchema.properties)).toStrictEqual([
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
      arguments: { create: {} },
    }) as CallResult;
    expect(write.isError, `${name} create should be rejected`).toBe(true);
  }
});

Deno.test("readonly mode leaves the enumeration tool intact", async () => {
  await using client = await connectTools(
    [enumerationTool(new FakeEnumerationPort())],
    "readonly",
  );
  const { tools } = await client.listTools();
  const enumerations = (tools as {
    name: string;
    description: string;
    inputSchema: { properties: Record<string, unknown> };
  }[]).find((tool) => tool.name === "redmine_enumerations");
  expect(enumerations, "enumeration tool should be advertised").toBeDefined();
  expect(Object.keys(enumerations!.inputSchema.properties)).toStrictEqual([
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
    arguments: { listTimeEntryActivities: {} },
  }) as CallResult;
  expect(listed.isError).not.toBe(true);
  const activities = JSON.parse(textOf(listed)) as { name: string }[];
  expect(activities.map((activity) => activity.name)).toStrictEqual([
    "Design",
    "Development",
  ]);
});

Deno.test("server advertises every registered tool and dispatches their CRUD", async () => {
  await using client = await connectTools(
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
    arguments: { create: { projectId: 1, title: "Home", text: "hi" } },
  }) as CallResult;
  expect(wikiCreated.isError).not.toBe(true);

  const wikiShown = await client.callTool({
    name: "redmine_wiki_pages",
    arguments: { show: { projectId: 1, title: "Home" } },
  }) as CallResult;
  const { wiki_page } = JSON.parse(textOf(wikiShown)) as {
    wiki_page: { text: string };
  };
  expect(wiki_page.text).toBe("hi");

  const versionCreated = await client.callTool({
    name: "redmine_versions",
    arguments: { create: { projectId: 1, name: "v1.0" } },
  }) as CallResult;
  expect(versionCreated.isError).not.toBe(true);

  const versionShown = await client.callTool({
    name: "redmine_versions",
    arguments: { show: { id: 1 } },
  }) as CallResult;
  const { version } = JSON.parse(textOf(versionShown)) as {
    version: { name: string };
  };
  expect(version.name).toBe("v1.0");

  const versionDeleted = await client.callTool({
    name: "redmine_versions",
    arguments: { delete: { id: 1 } },
  }) as CallResult;
  expect(versionDeleted.isError).not.toBe(true);

  const entryCreated = await client.callTool({
    name: "redmine_time_entries",
    arguments: { create: { projectId: 1, hours: 3 } },
  }) as CallResult;
  expect(entryCreated.isError).not.toBe(true);

  const entryShown = await client.callTool({
    name: "redmine_time_entries",
    arguments: { show: { id: 1 } },
  }) as CallResult;
  const { timeEntry } = JSON.parse(textOf(entryShown)) as {
    timeEntry: { hours: number };
  };
  expect(timeEntry.hours).toBe(3);

  const entryDeleted = await client.callTool({
    name: "redmine_time_entries",
    arguments: { delete: { id: 1 } },
  }) as CallResult;
  expect(entryDeleted.isError).not.toBe(true);

  const priorities = await client.callTool({
    name: "redmine_enumerations",
    arguments: { listIssuePriorities: {} },
  }) as CallResult;
  expect(priorities.isError).not.toBe(true);
});

Deno.test("readonly mode leaves both attachment actions available", async () => {
  const files = new FakeFilePort();
  await using client = await connectTools(
    [
      attachmentTool(
        new FakeAttachmentPort({
          7: {
            metadata: {
              id: 7,
              filename: "spec.txt",
              contentType: "text/plain",
            },
            content: "hello",
          },
        }),
        files,
      ),
    ],
    "readonly",
  );
  const { tools } = await client.listTools();
  const attachments = (tools as {
    name: string;
    description: string;
    inputSchema: { properties: Record<string, unknown> };
  }[]).find((tool) => tool.name === "redmine_attachments");
  expect(attachments, "attachment tool should be advertised").toBeDefined();
  expect(Object.keys(attachments!.inputSchema.properties)).toStrictEqual([
    "show",
    "download",
  ]);
  expect(
    !/create|update|delete/i.test(attachments!.description),
    `readonly description should not mention writes: ${
      attachments!.description
    }`,
  ).toBe(true);

  const downloaded = await client.callTool({
    name: "redmine_attachments",
    arguments: { download: { id: 7, path: "spec.txt" } },
  }) as CallResult;
  expect(downloaded.isError).not.toBe(true);
  expect(JSON.parse(textOf(downloaded))).toStrictEqual({
    path: "/absolute/spec.txt",
    filename: "spec.txt",
    contentType: "text/plain",
    filesize: 5,
  });
  expect(files.saved).toStrictEqual([
    { path: "spec.txt", content: "hello", maxSize: defaultMaxSize },
  ]);
});

const modes = Object.keys(
  { full: true, readonly: true } satisfies Record<Mode, true>,
) as Mode[];

Deno.test("every registered tool advertises an object schema with no top-level composition, which the Anthropic API rejects", async () => {
  const tools = registeredTools({
    endpoint: "https://redmine.invalid",
    apiKey: "unused",
  });
  for (const mode of modes) {
    await using client = await connectTools(tools, mode);
    const listed = await client.listTools();
    expect(listed.tools.length).toBe(tools.length);
    for (
      const tool of listed.tools as {
        name: string;
        inputSchema: Record<string, unknown>;
      }[]
    ) {
      expect(tool.inputSchema.type, `${mode} ${tool.name}`).toBe("object");
      for (const keyword of ["oneOf", "anyOf", "allOf"]) {
        expect(
          Object.hasOwn(tool.inputSchema, keyword),
          `${mode} ${tool.name} has top-level ${keyword}`,
        ).toBe(false);
      }
    }
  }
});

Deno.test("each advertised action is a property holding that action's own arguments", async () => {
  await using client = await connect("full");
  const { tools } = await client.listTools();
  const schema = (tools[0] as unknown as {
    inputSchema: {
      properties: Record<
        string,
        {
          properties?: Record<string, unknown>;
          required?: string[];
          anyOf?: { required?: string[] }[];
        }
      >;
      minProperties: number;
      maxProperties: number;
      additionalProperties: boolean;
    };
  }).inputSchema;
  expect(schema.minProperties).toBe(1);
  expect(schema.maxProperties).toBe(1);
  expect(schema.additionalProperties).toBe(false);
  expect(schema.properties.show.required).toStrictEqual(["id"]);
  expect(schema.properties.show.properties?.action).toBeUndefined();
  expect(schema.properties.list.required).toBeUndefined();
  expect(
    schema.properties.updateNote.anyOf?.map((branch) => branch.required),
  ).toStrictEqual([["journalId", "notes"], ["journalId", "privateNotes"]]);
});

Deno.test("arguments that do not name exactly one action are rejected with the valid actions listed", async () => {
  await using client = await connect("readonly");
  for (
    const args of [
      {},
      { list: {}, show: { id: 1 } },
      { action: "show", id: 1 },
    ]
  ) {
    const result = await client.callTool({
      name: "redmine_issues",
      arguments: args,
    }) as CallResult;
    expect(result.isError, JSON.stringify(args)).toBe(true);
    expect(textOf(result)).toContain("exactly one");
    expect(textOf(result)).toContain("list, show");
  }
});

Deno.test("an unknown tool is reported with the available tools listed", async () => {
  await using client = await connect("full");
  const result = await client.callTool({
    name: "redmine_issue",
    arguments: { list: {} },
  }) as CallResult;
  expect(result.isError).toBe(true);
  expect(JSON.parse(textOf(result))).toStrictEqual({
    status: 0,
    errors: ["unknown tool `redmine_issue`, one of: redmine_issues"],
  });
});

Deno.test("an action whose arguments are not an object is rejected", async () => {
  await using client = await connect("full");
  const result = await client.callTool({
    name: "redmine_issues",
    arguments: { show: 1 },
  }) as CallResult;
  expect(result.isError).toBe(true);
  expect(textOf(result)).toContain("show");
  expect(textOf(result)).toContain("object");
});

Deno.test("calls rejected before reaching Redmine report the same status-and-errors payload as Redmine failures", async () => {
  await using client = await connect("full");
  for (
    const call of [
      { name: "redmine_unknown", arguments: { list: {} } },
      { name: "redmine_issues", arguments: {} },
      { name: "redmine_issues", arguments: { show: { id: "one" } } },
    ]
  ) {
    const result = await client.callTool(call) as CallResult;
    expect(result.isError, JSON.stringify(call)).toBe(true);
    const failure = JSON.parse(textOf(result)) as {
      status: number;
      errors: string[];
    };
    expect(failure.status, JSON.stringify(call)).toBe(0);
    expect(failure.errors.length, JSON.stringify(call)).toBeGreaterThan(0);
  }
});

Deno.test("an argument validation error names the offending field as the model sent it", async () => {
  await using client = await connect("full");
  for (
    const [args, expected] of [
      [
        { show: { id: "one" } },
        'show.id: Invalid type: Expected number but received "one"',
      ],
      [{ show: {} }, "show.id: Invalid key"],
    ] as const
  ) {
    const result = await client.callTool({
      name: "redmine_issues",
      arguments: args,
    }) as CallResult;
    expect(result.isError, JSON.stringify(args)).toBe(true);
    const failure = JSON.parse(textOf(result)) as { errors: string[] };
    expect(failure.errors.join("\n"), JSON.stringify(args)).toContain(
      `invalid arguments: ${expected}`,
    );
  }
});

Deno.test("a misspelled field is rejected instead of being dropped from the call", async () => {
  await using client = await connect("full");
  const result = await client.callTool({
    name: "redmine_issues",
    arguments: { list: { projectID: "denomine" } },
  }) as CallResult;
  expect(result.isError).toBe(true);
  const failure = JSON.parse(textOf(result)) as { errors: string[] };
  expect(failure.errors.join("\n")).toContain(
    "invalid arguments: list.projectID: Invalid key",
  );
});

Deno.test("a field that matches none of its forms names the nested fields that failed", async () => {
  await using client = await connect("full");
  const errorsOf = async (createdOn: unknown) => {
    const result = await client.callTool({
      name: "redmine_issues",
      arguments: { list: { createdOn } },
    }) as CallResult;
    expect(result.isError).toBe(true);
    return (JSON.parse(textOf(result)) as { errors: string[] }).errors;
  };
  expect(await errorsOf({ from: "2026-01-01", to: "x" })).toStrictEqual([
    'invalid arguments: list.createdOn.to: Invalid date: Received "x"',
  ]);
  const misspelled = await errorsOf({ form: "2026-01-01" });
  expect(misspelled).toContain(
    'invalid arguments: list.createdOn.form: Invalid key: Expected never but received "form"',
  );
  expect(misspelled.join("\n")).not.toContain("but received Object");
});

Deno.test("a field whose type matches none of its forms keeps the list of forms", async () => {
  await using client = await connect("full");
  const result = await client.callTool({
    name: "redmine_issues",
    arguments: { list: { createdOn: 3 } },
  }) as CallResult;
  const { errors } = JSON.parse(textOf(result)) as { errors: string[] };
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain(
    "invalid arguments: list.createdOn: Invalid type: Expected (string",
  );
});

Deno.test("every advertised action of every tool declares that it takes no other fields", async () => {
  const tools = registeredTools({
    endpoint: "https://redmine.invalid",
    apiKey: "unused",
  });
  for (const mode of modes) {
    await using client = await connectTools(tools, mode);
    const listed = await client.listTools();
    for (const tool of listed.tools) {
      const actions = tool.inputSchema.properties as Record<
        string,
        { additionalProperties?: boolean; anyOf?: unknown[] }
      >;
      for (const [action, schema] of Object.entries(actions)) {
        const branches = (schema.anyOf ?? [schema]) as {
          additionalProperties?: boolean;
        }[];
        for (const branch of branches) {
          expect(
            branch.additionalProperties,
            `${mode} ${tool.name} ${action}`,
          ).toBe(false);
        }
      }
    }
  }
});

Deno.test("an unknown action is reported by name with the valid actions listed", async () => {
  await using client = await connect("readonly");
  for (
    const [args, action] of [[{ delete: { id: 1 } }, "delete"], [
      { nope: {} },
      "nope",
    ]] as const
  ) {
    const result = await client.callTool({
      name: "redmine_issues",
      arguments: args,
    }) as CallResult;
    expect(result.isError, JSON.stringify(args)).toBe(true);
    const failure = JSON.parse(textOf(result)) as { errors: string[] };
    expect(failure.errors, JSON.stringify(args)).toStrictEqual([
      `invalid arguments: unknown action \`${action}\`, one of: list, show`,
    ]);
  }
});

Deno.test("a record id is advertised and checked as a positive integer", async () => {
  await using client = await connect("full");
  const { tools } = await client.listTools();
  const show = (tools[0].inputSchema.properties as Record<
    string,
    { properties: Record<string, unknown> }
  >).show;
  expect(show.properties.id).toMatchObject({ type: "integer", minimum: 1 });
  for (
    const [id, message] of [[1.5, "Invalid integer"], [
      0,
      "Invalid value",
    ]] as const
  ) {
    const result = await client.callTool({
      name: "redmine_issues",
      arguments: { show: { id } },
    }) as CallResult;
    expect(result.isError, String(id)).toBe(true);
    expect(textOf(result), String(id)).toContain(
      `invalid arguments: show.id: ${message}`,
    );
  }
});

Deno.test("an action key cannot be overridden by an action field inside its arguments", async () => {
  await using client = await connect("readonly");
  const result = await client.callTool({
    name: "redmine_issues",
    arguments: { list: { action: "delete" } },
  }) as CallResult;
  expect(result.isError).not.toBe(true);
  expect(JSON.parse(textOf(result))).toStrictEqual({ issues: [] });
});

Deno.test("no tool description tells the model to pass an `action` argument, which the advertised schema no longer has", async () => {
  const tools = registeredTools({
    endpoint: "https://redmine.invalid",
    apiKey: "unused",
  });
  for (const mode of modes) {
    await using client = await connectTools(tools, mode);
    const listed = await client.listTools();
    for (
      const tool of listed.tools as { name: string; description: string }[]
    ) {
      expect(tool.description, `${mode} ${tool.name}`).not.toContain(
        "`action`",
      );
    }
  }
});
