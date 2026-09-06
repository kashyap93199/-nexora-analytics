import { describe, expect, it } from "vitest";
import { ALLOWED_TRANSITIONS } from "../Orders";
import type { OrderStatus } from "../../../types";

const ALL: OrderStatus[] = ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"];

describe("order status transitions (mirror of backend ALLOWED_TRANSITIONS)", () => {
  it("defines every status", () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual([...ALL].sort());
  });

  it("treats cancelled and refunded as terminal", () => {
    expect(ALLOWED_TRANSITIONS.cancelled).toEqual([]);
    expect(ALLOWED_TRANSITIONS.refunded).toEqual([]);
  });

  it("never allows moving backwards in fulfilment", () => {
    expect(ALLOWED_TRANSITIONS.shipped).not.toContain("pending");
    expect(ALLOWED_TRANSITIONS.shipped).not.toContain("processing");
    expect(ALLOWED_TRANSITIONS.delivered).toEqual(["refunded"]);
  });

  it("only allows refunds after shipment or delivery", () => {
    for (const from of ALL) {
      const allowed = ALLOWED_TRANSITIONS[from].includes("refunded");
      expect(allowed).toBe(from === "shipped" || from === "delivered");
    }
  });
});
