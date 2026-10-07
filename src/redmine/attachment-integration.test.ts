import { expect } from "@std/expect";
import { Result } from "@praha/byethrow";
import { RedmineClient } from "./client.ts";
import { AttachmentClient } from "./attachment-client.ts";

function env(name: string): string | undefined {
  try {
    return Deno.env.get(name);
  } catch {
    return undefined;
  }
}

const endpoint = env("DENOMINE_TEST_ENDPOINT");
const apiKey = env("DENOMINE_TEST_API_KEY");
const projectId = Number(env("DENOMINE_TEST_PROJECT_ID") ?? "1");
const content = "attachment integration content";

function streamOf(text: string): ReadableStream<Uint8Array> {
  return ReadableStream.from([new TextEncoder().encode(text)]);
}

type ShownIssue = {
  attachments: { id: number; filename: string; description: string }[];
  journals: { notes?: string }[];
};

/**
 * Exercises the real `@omochice/redmine`-backed attachment client end to end
 * against a live Redmine (see doc/verification.md). Skipped unless the endpoint
 * and API key are supplied.
 *
 * The content is attached as a stream rather than as bytes, because that is
 * how the tool hands a local file to Redmine. The issue carrying the
 * attachments is removed afterwards.
 */
Deno.test({
  name: "AttachmentClient attaches and reads attachments on a live Redmine",
  ignore: endpoint == null || apiKey == null,
  sanitizeResources: false,
  fn: async (t) => {
    const context = { endpoint: endpoint!, apiKey: apiKey! };
    const issues = new RedmineClient(context);
    const attachments = new AttachmentClient(context);
    await using cleanup = new AsyncDisposableStack();

    const subject = `attachment ${Date.now()}`;
    const created = await issues.create({
      projectId,
      trackerId: 1,
      statusId: 1,
      priorityId: 2,
      subject,
    });
    expect(Result.isSuccess(created), JSON.stringify(created)).toBe(true);
    const listed = await issues.list({ projectId });
    expect(Result.isSuccess(listed)).toBe(true);
    const issue = (Result.unwrap(listed) as { id: number; subject: string }[])
      .find((candidate) => candidate.subject === subject);
    expect(issue, `created issue ${subject} not found`).toBeDefined();
    const issueId = issue!.id;
    cleanup.defer(async () => {
      await issues.delete(issueId);
    });

    async function shownIssue(): Promise<ShownIssue> {
      const shown = await issues.show(issueId, ["attachments", "journals"]);
      expect(Result.isSuccess(shown), JSON.stringify(shown)).toBe(true);
      return Result.unwrap(shown) as ShownIssue;
    }

    const attached = await attachments.attach(issueId, streamOf(content), {
      filename: "integration.txt",
    });
    expect(Result.isSuccess(attached), JSON.stringify(attached)).toBe(true);
    const [attachment] = (await shownIssue()).attachments;
    expect(attachment, "attachment not found on the issue").toBeDefined();
    const attachmentId = attachment.id;

    await t.step("attach adds the file under the given filename", () => {
      expect(attachment.filename).toBe("integration.txt");
    });

    await t.step(
      "attach records the description and the comment together",
      async () => {
        const again = await attachments.attach(issueId, streamOf("second"), {
          filename: "second.txt",
          description: "second file",
          notes: "attached a second file",
        });
        expect(Result.isSuccess(again), JSON.stringify(again)).toBe(true);

        const shown = await shownIssue();
        expect(
          shown.attachments
            .map(({ filename, description }) => ({ filename, description }))
            .toSorted((a, b) => a.filename.localeCompare(b.filename)),
        ).toStrictEqual([
          { filename: "integration.txt", description: "" },
          { filename: "second.txt", description: "second file" },
        ]);
        expect(shown.journals.map(({ notes }) => notes)).toContain(
          "attached a second file",
        );
      },
    );

    await t.step("attach fails for an issue that does not exist", async () => {
      const result = await attachments.attach(
        issueId + 100_000,
        streamOf("orphan"),
        { filename: "orphan.txt" },
      );
      expect(Result.isFailure(result)).toBe(true);
    });

    await t.step("show returns the attachment metadata", async () => {
      const result = await attachments.show(attachmentId);
      expect(Result.isSuccess(result), JSON.stringify(result)).toBe(true);
      const shown = Result.unwrap(result) as {
        id: number;
        filename: string;
        filesize: number;
      };
      expect(shown.id).toBe(attachmentId);
      expect(shown.filename).toBe("integration.txt");
      expect(shown.filesize).toBe(content.length);
    });

    await t.step("download streams the content back", async () => {
      const result = await attachments.download(attachmentId);
      expect(Result.isSuccess(result), JSON.stringify(result)).toBe(true);
      const downloaded = Result.unwrap(result);
      expect(downloaded.filename).toBe("integration.txt");
      expect(downloaded.filesize).toBe(content.length);
      expect(await new Response(downloaded.body).text()).toBe(content);
    });

    await t.step("show fails for an unknown attachment", async () => {
      const result = await attachments.show(attachmentId + 100_000);
      expect(Result.isFailure(result)).toBe(true);
    });
  },
});
