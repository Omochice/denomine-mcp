import type { Notice } from "./notice.ts";

const RULE = "=".repeat(80);

function formatNotice(notice: Notice): string {
  const header = `${notice.name} ${notice.version}`;
  const texts = notice.texts.map((text) =>
    `--- ${text.file} ---\n${text.content.trimEnd()}`
  );
  return [RULE, header, RULE, ...texts].join("\n");
}

/** Renders every notice in full, in the order given, for printing to a terminal. */
export function formatNotices(notices: readonly Notice[]): string {
  return notices.map(formatNotice).join("\n\n");
}
