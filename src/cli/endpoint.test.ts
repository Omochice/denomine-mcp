import { expect } from "jsr:@std/expect@1.0.20";
import { canonicalizeEndpoint } from "./endpoint.ts";

Deno.test("canonicalizeEndpoint maps equivalent URLs to one account", () => {
  expect(canonicalizeEndpoint("https://R.Example.com/")).toBe(
    "https://r.example.com",
  );
  expect(canonicalizeEndpoint("https://r.example.com")).toBe(
    "https://r.example.com",
  );
  expect(canonicalizeEndpoint("http://localhost:3000/?token=x#frag")).toBe(
    "http://localhost:3000",
  );
  expect(canonicalizeEndpoint("https://host/redmine/")).toBe(
    "https://host/redmine",
  );
});

Deno.test("canonicalizeEndpoint rejects an unparseable URL", () => {
  expect(() => canonicalizeEndpoint("not a url")).toThrow();
});
