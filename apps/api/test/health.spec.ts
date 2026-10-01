import { describe, expect, it } from "vitest";
import { HealthController } from "../src/health.controller";

describe("HealthController", () => {
  it("reports the API as healthy", () => {
    expect(new HealthController().getHealth()).toEqual({
      status: "ok",
      service: "api",
    });
  });
});
