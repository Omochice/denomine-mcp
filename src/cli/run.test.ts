import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.18";
import { FakeKeyring } from "../keyring/fake.ts";
import { resolveContext, runList, runLogin, runLogout } from "./run.ts";

Deno.test("runLogin stores the trimmed key under the canonical account", async () => {
  const keyring = new FakeKeyring();
  const account = await runLogin(
    "https://R.example.com/",
    keyring,
    () => Promise.resolve("  abc123\n"),
  );
  assertEquals(account, "https://r.example.com");
  assertEquals(await keyring.get("https://r.example.com"), "abc123");
});

Deno.test("runLogin rejects an empty key", async () => {
  await assertRejects(() =>
    runLogin(
      "https://r.example.com",
      new FakeKeyring(),
      () => Promise.resolve("   \n"),
    )
  );
});

Deno.test("resolveContext returns the stored key for the canonical account", async () => {
  const keyring = new FakeKeyring({ "https://r.example.com": "k" });
  const context = await resolveContext("https://r.example.com/", keyring);
  assertEquals(context, { endpoint: "https://r.example.com", apiKey: "k" });
});

Deno.test("resolveContext fails when no key is stored", async () => {
  await assertRejects(() =>
    resolveContext("https://r.example.com", new FakeKeyring())
  );
});

Deno.test("runLogout removes the stored key", async () => {
  const keyring = new FakeKeyring({ "https://r.example.com": "k" });
  await runLogout("https://r.example.com/", keyring);
  assertEquals(await keyring.get("https://r.example.com"), undefined);
});

Deno.test("runList returns the stored endpoints sorted", async () => {
  const keyring = new FakeKeyring({
    "https://b.example.com": "k2",
    "https://a.example.com": "k1",
  });
  assertEquals(await runList(keyring), [
    "https://a.example.com",
    "https://b.example.com",
  ]);
});

Deno.test("runList returns an empty list when nothing is stored", async () => {
  assertEquals(await runList(new FakeKeyring()), []);
});
