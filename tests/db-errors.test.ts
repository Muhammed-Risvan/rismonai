import { describe, expect, it } from "vitest";

import { isUniqueViolation } from "@/server/db/errors";

/** Mirrors drizzle's `DrizzleQueryError`: message + driver error on `cause`. */
function drizzleWrap(query: string, cause: unknown): Error {
  return Object.assign(new Error(`Failed query: ${query}`), { cause });
}

function driverError(code: string): Error {
  return Object.assign(new Error(`SQLSTATE ${code}`), { code });
}

describe("isUniqueViolation", () => {
  it("matches a raw driver error with SQLSTATE 23505", () => {
    expect(isUniqueViolation(driverError("23505"))).toBe(true);
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("matches a drizzle-wrapped query error through its cause", () => {
    expect(
      isUniqueViolation(
        drizzleWrap('insert into "diagnostic_runs"', driverError("23505")),
      ),
    ).toBe(true);
  });

  it("matches nested cause chains", () => {
    expect(
      isUniqueViolation(
        drizzleWrap("outer", drizzleWrap("inner", driverError("23505"))),
      ),
    ).toBe(true);
  });

  it("does not match other SQLSTATEs or unwrapped failures", () => {
    expect(isUniqueViolation(driverError("23503"))).toBe(false);
    expect(isUniqueViolation(drizzleWrap("insert", driverError("23503")))).toBe(
      false,
    );
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });

  it("terminates on a self-referencing cause", () => {
    const circular: { cause?: unknown } = {};
    circular.cause = circular;
    expect(isUniqueViolation(circular)).toBe(false);
  });
});