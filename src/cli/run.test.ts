import { expect } from "jsr:@std/expect@1.0.20";
import { FakeKeyring } from "../keyring/fake.ts";
import { resolveContext, runList, runLogin, runLogout } from "./run.ts";

Deno.test("runLogin stores the trimmed key under the canonical account", async () => {
  const keyring = new FakeKeyring();
  const account = await runLogin(
    "https://R.example.com/",
    keyring,
    () => Promise.resolve("  abc123\n"),
  );
  expect(account).toBe("https://r.example.com");
  expect(await keyring.get("https://r.example.com")).toBe("abc123");
});

Deno.test("runLogin rejects an empty key", async () => {
  await expect(
    runLogin(
      "https://r.example.com",
      new FakeKeyring(),
      () => Promise.resolve("   \n"),
    ),
  ).rejects.toThrow();
});

Deno.test("resolveContext returns the stored key for the canonical account", async () => {
  const keyring = new FakeKeyring({ "https://r.example.com": "k" });
  const context = await resolveContext("https://r.example.com/", keyring);
  expect(context).toStrictEqual({
    endpoint: "https://r.example.com",
    apiKey: "k",
  });
});

Deno.test("resolveContext fails when no key is stored", async () => {
  await expect(resolveContext("https://r.example.com", new FakeKeyring()))
    .rejects.toThrow();
});

Deno.test("runLogout removes the stored key", async () => {
  const keyring = new FakeKeyring({ "https://r.example.com": "k" });
  await runLogout("https://r.example.com/", keyring);
  expect(await keyring.get("https://r.example.com")).toBe(undefined);
});

Deno.test("runList returns the stored endpoints sorted", async () => {
  const keyring = new FakeKeyring({
    "https://b.example.com": "k2",
    "https://a.example.com": "k1",
  });
  expect(await runList(keyring)).toStrictEqual([
    "https://a.example.com",
    "https://b.example.com",
  ]);
});

Deno.test("runList returns an empty list when nothing is stored", async () => {
  expect(await runList(new FakeKeyring())).toStrictEqual([]);
});
