import { expect } from "jsr:@std/expect@1.0.20";
import { FakeEnumerationPort } from "../../redmine/fake.ts";
import { handleEnumeration } from "./handler.ts";

function namesOf(response: { content: { text: string }[] }): string[] {
  const enumerations = JSON.parse(response.content[0].text) as {
    name: string;
  }[];
  return enumerations.map((enumeration) => enumeration.name);
}

Deno.test("enumeration handler dispatches each listing to its own port method", async (t) => {
  const port = new FakeEnumerationPort();

  await t.step("time entry activities", async () => {
    const response = await handleEnumeration(port, {
      action: "listTimeEntryActivities",
    });
    expect(namesOf(response)).toStrictEqual(["Design", "Development"]);
  });

  await t.step("issue priorities", async () => {
    const response = await handleEnumeration(port, {
      action: "listIssuePriorities",
    });
    expect(namesOf(response)).toStrictEqual(["Low", "Normal"]);
  });

  await t.step("document categories", async () => {
    const response = await handleEnumeration(port, {
      action: "listDocumentCategories",
    });
    expect(namesOf(response)).toStrictEqual(["User documentation"]);
  });
});

Deno.test("enumeration handler exposes the activity id a time entry needs", async () => {
  const port = new FakeEnumerationPort();
  const response = await handleEnumeration(port, {
    action: "listTimeEntryActivities",
  });
  const activities = JSON.parse(response.content[0].text) as {
    id: number;
    isDefault: boolean;
  }[];
  expect(activities.find((activity) => activity.isDefault)?.id).toBe(9);
});
