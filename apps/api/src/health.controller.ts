import { Controller, Get } from "@nestjs/common";
import { HealthResponseSchema, type HealthResponse } from "@pindash/contracts";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return HealthResponseSchema.parse({ status: "ok", service: "api" });
  }
}
