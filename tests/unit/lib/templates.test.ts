import { describe, expect, it } from "vitest";
import { fillTemplate, templateIdFor } from "@/lib/email/template-utils";

describe("email templates", () => {
  it("fills placeholders and strips unknown ones", () => {
    expect(fillTemplate("[{{ticket.key}}] Hi {{requester.first_name}} {{unknown.x}}!", { "ticket.key": "EXP-1", "requester.first_name": "Sanduni" })).toBe("[EXP-1] Hi Sanduni !");
  });
  it("maps notification kinds to template ids", () => {
    expect(templateIdFor("status_resolved")).toBe("status_resolved");
    expect(templateIdFor("mentioned")).toBeNull();
  });
});
