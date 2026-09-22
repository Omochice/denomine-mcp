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

/**
 * Exercises the real `@omochice/redmine`-backed attachment client end to end
 * against a live Redmine (see doc/verification.md). Skipped unless the endpoint
 * and API key are supplied.
 *
 * Redmine has no endpoint that creates an attachment on its own: a file is
 * uploaded for a token, and the token is attached to an issue. Neither step is
 * part of any port here, so both are driven with raw requests, and the issue
 * carrying the attachment is removed afterwards.
 */
Deno.test({
  name: "AttachmentClient reads an attachment from a live Redmine",
  ignore: endpoint === undefined || apiKey === undefined,
  sanitizeResources: false,
  fn: async (t) => {
    const context = { endpoint: endpoint!, apiKey: apiKey! };
    const issues = new RedmineClient(context);
    const attachments = new AttachmentClient(context);

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

    try {
      const uploaded = await fetch(`${context.endpoint}/uploads.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Redmine-API-Key": context.apiKey,
        },
        body: new TextEncoder().encode(content),
      });
      expect(uploaded.ok, `upload failed with ${uploaded.status}`).toBe(true);
      const { upload } = await uploaded.json() as {
        upload: { token: string };
      };

      const attached = await fetch(
        `${context.endpoint}/issues/${issueId}.json`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Redmine-API-Key": context.apiKey,
          },
          body: JSON.stringify({
            issue: {
              uploads: [{
                token: upload.token,
                filename: "integration.txt",
                content_type: "text/plain",
              }],
            },
          }),
        },
      );
      expect(attached.ok, `attaching failed with ${attached.status}`).toBe(
        true,
      );
      await attached.body?.cancel();

      const shownIssue = await issues.show(issueId, ["attachments"]);
      expect(Result.isSuccess(shownIssue)).toBe(true);
      const attachment =
        (Result.unwrap(shownIssue) as { attachments: { id: number }[] })
          .attachments[0];
      expect(attachment, "uploaded attachment not found on the issue")
        .toBeDefined();
      const attachmentId = attachment.id;

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
    } finally {
      await issues.delete(issueId);
    }
  },
});
