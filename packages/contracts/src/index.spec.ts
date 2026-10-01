import { describe, expect, it } from "vitest";
import {
  HealthResponseSchema,
  PinStatusSchema,
  SavePinDraftSchema,
} from "./index";

describe("contracts", () => {
  it("accepts known health responses and Pin states", () => {
    expect(
      HealthResponseSchema.parse({ status: "ok", service: "api" }).status,
    ).toBe("ok");
    expect(PinStatusSchema.parse("awaiting_approval")).toBe(
      "awaiting_approval",
    );
  });

  it("validates safe partial Pin drafts", () => {
    const draft = SavePinDraftSchema.parse({
      workspaceId: "d9428888-122b-11e1-b85c-61cd3cbb3210",
      title: "A useful Pin",
      description: "",
      destinationUrl: "https://example.com/guide",
    });
    expect(draft.title).toBe("A useful Pin");
    expect(() =>
      SavePinDraftSchema.parse({
        ...draft,
        destinationUrl: "ftp://example.com/file",
      }),
    ).toThrow();
  });
});
