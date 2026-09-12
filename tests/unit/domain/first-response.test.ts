import { describe, expect, it } from "vitest";
import { commentCountsAsFirstResponse, statusChangeCountsAsFirstResponse } from "@/lib/domain/first-response";

describe("first response rule (requirements §5.3)", () => {
  it("public staff comment counts, internal note does not", () => {
    expect(commentCountsAsFirstResponse("agent", "public")).toBe(true);
    expect(commentCountsAsFirstResponse("agent", "internal")).toBe(false);
  });
  it("developer public reply counts", () => {
    expect(commentCountsAsFirstResponse("developer", "public")).toBe(true);
  });
  it("client comment and system never count", () => {
    expect(commentCountsAsFirstResponse("client_user", "public")).toBe(false);
    expect(commentCountsAsFirstResponse("system", "public")).toBe(false);
  });
  it("status change to in_progress/pending_client/resolved by staff counts; open does not", () => {
    expect(statusChangeCountsAsFirstResponse("agent", "in_progress")).toBe(true);
    expect(statusChangeCountsAsFirstResponse("lead", "pending_client")).toBe(true);
    expect(statusChangeCountsAsFirstResponse("admin", "resolved")).toBe(true);
    expect(statusChangeCountsAsFirstResponse("agent", "open")).toBe(false);
    expect(statusChangeCountsAsFirstResponse("client_user", "in_progress")).toBe(false);
  });
});
