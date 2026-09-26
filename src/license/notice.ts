/**
 * One third-party package shipped in the binary, with the license files that
 * carry its copyright notice (see ADR-0013).
 */
export type Notice = {
  name: string;
  version: string;
  source: "jsr" | "npm" | "crates.io";
  texts: { file: string; content: string }[];
};
