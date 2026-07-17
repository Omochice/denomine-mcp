import { assertEquals } from "jsr:@std/assert@1.0.18";
import { errorFromCause, toRedmineError } from "./error.ts";

Deno.test("toRedmineError extracts the status and Redmine errors array", async () => {
  const response = new Response(
    JSON.stringify({
      errors: ["Subject cannot be blank", "Tracker is invalid"],
    }),
    { status: 422 },
  );
  assertEquals(await toRedmineError(response), {
    status: 422,
    errors: ["Subject cannot be blank", "Tracker is invalid"],
  });
});

Deno.test("toRedmineError yields status only when the body has no errors array", async (t) => {
  await t.step("empty body (e.g. 404)", async () => {
    assertEquals(await toRedmineError(new Response(null, { status: 404 })), {
      status: 404,
      errors: [],
    });
  });

  await t.step("non-JSON body", async () => {
    const response = new Response("<html>nope</html>", { status: 500 });
    assertEquals(await toRedmineError(response), { status: 500, errors: [] });
  });

  await t.step("JSON body without an errors array", async () => {
    const response = new Response(JSON.stringify({ message: "denied" }), {
      status: 403,
    });
    assertEquals(await toRedmineError(response), { status: 403, errors: [] });
  });
});

Deno.test("toRedmineError discloses only status and errors, never headers or auth", async () => {
  const response = new Response(JSON.stringify({ errors: ["bad"] }), {
    status: 422,
    headers: {
      "set-cookie": "session=secret",
      "x-redmine-api-key": "leaked-key",
    },
  });
  const result = await toRedmineError(response);
  assertEquals(Object.keys(result).sort(), ["errors", "status"]);
});

Deno.test("errorFromCause reads the Response carried as the error cause", async () => {
  const cause = new Response(JSON.stringify({ errors: ["Name is invalid"] }), {
    status: 422,
  });
  const error = new Error("Unprocessable Entity", { cause });
  assertEquals(await errorFromCause(error), {
    status: 422,
    errors: ["Name is invalid"],
  });
});

Deno.test("errorFromCause falls back to the message when there is no Response", async () => {
  assertEquals(await errorFromCause(new Error("connection refused")), {
    status: 0,
    errors: ["connection refused"],
  });
});
