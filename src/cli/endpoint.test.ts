import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.18";
import { canonicalizeEndpoint } from "./endpoint.ts";

Deno.test("canonicalizeEndpoint maps equivalent URLs to one account", () => {
  assertEquals(
    canonicalizeEndpoint("https://R.Example.com/"),
    "https://r.example.com",
  );
  assertEquals(
    canonicalizeEndpoint("https://r.example.com"),
    "https://r.example.com",
  );
  assertEquals(
    canonicalizeEndpoint("http://localhost:3000/?token=x#frag"),
    "http://localhost:3000",
  );
  assertEquals(
    canonicalizeEndpoint("https://host/redmine/"),
    "https://host/redmine",
  );
});

Deno.test("canonicalizeEndpoint rejects an unparseable URL", () => {
  assertThrows(() => canonicalizeEndpoint("not a url"));
});
