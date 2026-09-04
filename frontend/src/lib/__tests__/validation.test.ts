import { describe, expect, it } from "vitest";
import { validateEmail, validatePassword, validateRegistration } from "../validation";
import { computeRange, intervalForRange } from "../dates";
import { formatCurrency, initials, cn } from "../utils";

describe("validateRegistration", () => {
  const valid = { full_name: "Alex Morgan", email: "alex@corp.example", password: "StrongPass1", organization_name: "Acme Inc" };

  it("accepts a fully valid form", () => {
    expect(validateRegistration(valid)).toEqual({});
  });

  it("rejects an empty form with all fields required", () => {
    const errors = validateRegistration({ full_name: "", email: "", password: "", organization_name: "" });
    expect(errors.full_name).toBeDefined();
    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
    expect(errors.organization_name).toBeDefined();
  });

  it("rejects a short name", () => {
    expect(validateRegistration({ ...valid, full_name: "A" }).full_name).toBeDefined();
  });

  it("rejects malformed emails", () => {
    expect(validateEmail("not-an-email")).toMatch(/valid email/);
    expect(validateEmail("missing@tld")).toMatch(/valid email/);
  });

  it("requires 8+ chars, a digit and an uppercase letter", () => {
    expect(validatePassword("short1A")).toMatch(/8 characters/);
    expect(validatePassword("alllowercase1")).toMatch(/uppercase/);
    expect(validatePassword("NoNumbersHere")).toMatch(/number/);
    expect(validatePassword("GoodPass1")).toBeNull();
  });

  it("rejects a missing organization name", () => {
    expect(validateRegistration({ ...valid, organization_name: "" }).organization_name).toBeDefined();
  });
});

describe("date ranges", () => {
  it("last30 spans 30 days ending today", () => {
    const range = computeRange("last30");
    const days = (Date.parse(range.end) - Date.parse(range.start)) / 86_400_000 + 1;
    expect(days).toBe(30);
    expect(range.end).toBe(new Date().toISOString().slice(0, 10));
  });

  it("suggests day interval for short ranges and month for long ones", () => {
    expect(intervalForRange(7)).toBe("day");
    expect(intervalForRange(60)).toBe("week");
    expect(intervalForRange(400)).toBe("month");
  });
});

describe("formatting helpers", () => {
  it("formats currency with compact notation when large", () => {
    expect(formatCurrency(128430, "USD", true)).toContain("128.4");
  });

  it("derives initials from a name", () => {
    expect(initials("alex morgan")).toBe("AM");
    expect(initials("Cher")).toBe("C");
  });

  it("merges classes with clsx", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });
});
