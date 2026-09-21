import { expect } from "jsr:@std/expect@1.0.20";
import { FakeAttachmentPort } from "../../redmine/fake.ts";
import { FakeFilePort } from "../../file/fake.ts";
import { handleAttachment } from "./handler.ts";

function textOf(response: { content: { text: string }[] }): string {
  return response.content[0].text;
}

function failureOf(response: { content: { text: string }[] }): {
  status: number;
  errors: string[];
} {
  return JSON.parse(textOf(response)) as { status: number; errors: string[] };
}

function seeded(filesize?: number): FakeAttachmentPort {
  return new FakeAttachmentPort({
    1: {
      metadata: {
        id: 1,
        filename: "spec.txt",
        contentType: "text/plain",
        ...(filesize === undefined ? {} : { filesize }),
      },
      content: "hello",
    },
  });
}

Deno.test("attachment handler returns the metadata for show", async () => {
  const response = await handleAttachment(seeded(), new FakeFilePort(), {
    action: "show",
    id: 1,
  });
  expect(response.isError).not.toBe(true);
  const { attachment } = JSON.parse(textOf(response)) as {
    attachment: { filename: string };
  };
  expect(attachment.filename).toBe("spec.txt");
});

Deno.test("attachment handler saves the content and returns the written path", async () => {
  const files = new FakeFilePort();
  const response = await handleAttachment(seeded(), files, {
    action: "download",
    id: 1,
    path: "spec.txt",
    maxSize: 1024,
  });
  expect(response.isError).not.toBe(true);
  const saved = JSON.parse(textOf(response)) as Record<string, unknown>;
  expect(saved).toStrictEqual({
    path: "/absolute/spec.txt",
    filename: "spec.txt",
    contentType: "text/plain",
    filesize: 5,
  });
  expect(files.saved).toStrictEqual([
    { path: "spec.txt", content: "hello", maxSize: 1024 },
  ]);
});

Deno.test("attachment handler reports a failed Redmine download without touching the filesystem", async () => {
  const files = new FakeFilePort();
  const response = await handleAttachment(new FakeAttachmentPort(), files, {
    action: "download",
    id: 9,
    path: "spec.txt",
    maxSize: 1024,
  });
  expect(response.isError).toBe(true);
  expect(failureOf(response)).toStrictEqual({ status: 404, errors: [] });
  expect(files.saved).toStrictEqual([]);
});

Deno.test("attachment handler refuses an attachment larger than maxSize before writing", async () => {
  const port = seeded();
  const files = new FakeFilePort();
  const response = await handleAttachment(port, files, {
    action: "download",
    id: 1,
    path: "spec.txt",
    maxSize: 4,
  });
  expect(response.isError).toBe(true);
  expect(failureOf(response).errors[0]).toBe(
    "attachment 1 is 5 bytes, which exceeds the maxSize limit of 4 bytes",
  );
  expect(files.saved).toStrictEqual([]);
  expect(port.cancelled).toStrictEqual([1]);
});

Deno.test("attachment handler reports a stream that outgrows maxSize as a tool error", async () => {
  const files = new FakeFilePort();
  const response = await handleAttachment(seeded(1), files, {
    action: "download",
    id: 1,
    path: "spec.txt",
    maxSize: 4,
  });
  expect(response.isError).toBe(true);
  expect(failureOf(response)).toStrictEqual({
    status: 0,
    errors: ["content exceeds the maxSize limit of 4 bytes"],
  });
});

Deno.test("attachment handler reports a failed save as a tool error", async () => {
  const response = await handleAttachment(
    seeded(),
    new FakeFilePort({ failWith: "file already exists" }),
    { action: "download", id: 1, path: "spec.txt", maxSize: 1024 },
  );
  expect(response.isError).toBe(true);
  expect(failureOf(response)).toStrictEqual({
    status: 0,
    errors: ["file already exists"],
  });
});
